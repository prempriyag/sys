"""
ECI Electoral Roll PDF Downloader
Automates downloading electoral roll PDF from voters.eci.gov.in:
- Pre-fills state, revyear, roleType, district, Assembly Constituency
- Reads captcha via OCR and enters it; retries on invalid captcha
- Selects first row in parts table
- Clicks Download Selected PDFs, saves to backend/pdf

On Windows, Playwright fails when run inside uvicorn (NotImplementedError).
We run the automation in a separate Python subprocess via scripts/run_eci_download.py.
"""
import base64
import io
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

ECI_DOWNLOAD_URL = "https://voters.eci.gov.in/download-eroll"

# Default form values (overridable via API/script args) — aligned with voters.eci.gov.in/download-eroll
DEFAULT_STATE = "Tamil Nadu"
DEFAULT_REVYEAR = "2026"
DEFAULT_DISTRICT = "Chennai"
DEFAULT_AC_NAME = "11 - Dr.Radhakrishnan Nagar"
MAX_CAPTCHA_RETRIES = 5
# ECI allows max 10 parts per "Download Selected PDFs" click — batch in groups of 10 to get all parts
MAX_PARTS_PER_DOWNLOAD = 10
# Manual mode: do NOT auto-toggle checkboxes and do NOT auto-click Download.
# User selects rows and clicks "Download Selected PDFs"; automation waits/saves and paginates.
AUTO_SELECT_PARTS = False
# If True, once "Select All" is checked on page 1 the script auto-downloads all pages.
# Set True to download all pages automatically after starting.
PERSIST_SELECT_ALL_ACROSS_PAGES = True
# If True and manual_captcha=True, after you type captcha the script auto-submits Search/Show
# and then automatically selects/batches downloads on page 1 and subsequent pages.
AUTO_START_AFTER_MANUAL_CAPTCHA = True
# Where final PDFs are saved (relative to backend/).
# User wants: backend/download/<state>/<year>/<district>/<constituency>/
BASE_DOWNLOAD_DIR = "download"
# If True, allow selecting English as a fallback language.
# Default False because on some ECI sessions selecting English can redirect to /login.
AUTO_LANGUAGE_FALLBACK_TO_ENGLISH = True

# ECI rate limiting: when the portal shows "You have exceeded the request limit..."
# we must back off or we'll get repeated "Error Occured!!" toasts and empty/non-PDF downloads.
ECI_RATE_LIMIT_BACKOFF_S = 90


# ECI state codes for URL pre-selection (?statecode=Sxx). Avoids fragile dropdown interaction.
# Numbering aligned with ECI numeric codes; URL uses S + 2 digits (e.g. S37 for Andhra Pradesh).
ECI_STATE_CODES = {
    "jammu and kashmir": "S01",
    "himachal pradesh": "S02",
    "punjab": "S03",
    "chandigarh": "S04",
    "uttarakhand": "S05",
    "haryana": "S06",
    "delhi": "S07",
    "rajasthan": "S08",
    "uttar pradesh": "S09",
    "bihar": "S10",
    "sikkim": "S11",
    "arunachal pradesh": "S12",
    "nagaland": "S13",
    "manipur": "S14",
    "mizoram": "S15",
    "tripura": "S16",
    "meghalaya": "S17",
    "assam": "S18",
    "west bengal": "S19",
    "jharkhand": "S20",
    "odisha": "S21",
    "chhattisgarh": "S22",
    "madhya pradesh": "S23",
    "gujarat": "S24",
    "dadra and nagar haveli and daman and diu": "S25",
    "dadra and nagar haveli": "S26",
    "daman and diu": "S25",
    "maharashtra": "S27",
    "karnataka": "S29",
    "goa": "S30",
    "lakshadweep": "S31",
    "kerala": "S32",
    "tamil nadu": "S33",
    "puducherry": "S34",
    "andaman and nicobar islands": "S35",
    "andaman and nicobar": "S35",
    "telangana": "S36",
    "andhra pradesh": "S37",
    "ladakh": "S38",
}


# Default Tesseract path on Windows (use when not in PATH). Set in env to override.
TESSERACT_EXE_WINDOWS = os.environ.get("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")

# Lazy-initialized EasyOCR reader (avoids repeated model load; helps on Windows when no console)
_easyocr_reader = None


def _get_easyocr_reader():
    """Create or return cached EasyOCR Reader. On Windows, temporarily redirect stderr to avoid I/O errors when no console."""
    global _easyocr_reader
    if _easyocr_reader is not None:
        return _easyocr_reader
    import easyocr
    saved_stderr = None
    devnull_file = None
    if sys.platform == "win32":
        saved_stderr = sys.stderr
        try:
            devnull_file = open(os.devnull, "w", encoding="utf-8")
            sys.stderr = devnull_file
        except Exception:
            pass
    try:
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
        return _easyocr_reader
    finally:
        if saved_stderr is not None:
            sys.stderr = saved_stderr
        if devnull_file is not None:
            try:
                devnull_file.close()
            except Exception:
                pass


def _preprocess_captcha_image(img, strong: bool = True) -> "Image.Image":
    """Preprocess captcha image for OCR: grayscale, resize if small, optional contrast/sharpen."""
    from PIL import Image, ImageEnhance
    if img.mode != "L":
        img = img.convert("L")
    w, h = img.size
    if w < 120 or h < 40:
        scale = max(120 / w, 40 / h, 1.5)
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)
    if strong:
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.8)
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.5)
    else:
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.3)
    return img


def _preprocess_captcha_cv2(pil_img: "Image.Image", fixed_threshold: bool = True) -> "Image.Image":
    """
    OpenCV preprocessing for captcha OCR.
    Recipe (based on user-provided approach):
    - resize (2x) to improve OCR
    - grayscale
    - gaussian blur (noise reduction)
    - threshold (fixed=150 by default, or OTSU fallback)
    - morphology open (remove thin noise lines)
    Returns PIL Image.
    """
    try:
        from PIL import Image
        import cv2
        import numpy as np
        arr = np.array(pil_img)
        if len(arr.shape) == 3:
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        else:
            gray = arr

        # Resize improves OCR stability on low-res captchas.
        # Use 2x by default, but if extremely small, push to 3x.
        h, w = gray.shape[:2]
        scale = 3.0 if (w < 90 or h < 30) else 2.0
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        if fixed_threshold:
            _, thresh = cv2.threshold(blur, 150, 255, cv2.THRESH_BINARY)
        else:
            _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Remove small background lines/noise.
        kernel = np.ones((2, 2), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

        return Image.fromarray(thresh)
    except Exception:
        return pil_img


def _preprocess_captcha_cv2_adaptive(pil_img: "Image.Image") -> "Image.Image":
    """
    Adaptive-threshold preprocessing (often better for captchas with uneven background).
    Steps:
    - grayscale
    - resize (3x)
    - adaptive threshold (Gaussian)
    - morphology close (fill gaps / strengthen strokes)
    """
    try:
        from PIL import Image
        import cv2
        import numpy as np
        arr = np.array(pil_img)
        if len(arr.shape) == 3:
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        else:
            gray = arr
        gray = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
        thr = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2,
        )
        kernel = np.ones((2, 2), np.uint8)
        clean = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, kernel)
        return Image.fromarray(clean)
    except Exception:
        return pil_img


def _preprocess_captcha_cv2_green_mask(pil_img: "Image.Image") -> "Image.Image":
    """
    ECI captchas are often green text with noise lines.
    This tries to isolate green-ish pixels in HSV and produce a high-contrast binary image.
    """
    try:
        from PIL import Image
        import cv2
        import numpy as np
        arr = np.array(pil_img.convert("RGB"))
        hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
        # Broad green range; allow darker/lighter variants.
        lower = np.array([25, 40, 40], dtype=np.uint8)
        upper = np.array([95, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower, upper)

        # Upscale to help OCR.
        mask = cv2.resize(mask, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_NEAREST)

        # Invert: text as black on white background.
        inv = 255 - mask

        # Clean small artifacts/lines.
        k = np.ones((2, 2), np.uint8)
        inv = cv2.morphologyEx(inv, cv2.MORPH_OPEN, k)
        inv = cv2.morphologyEx(inv, cv2.MORPH_CLOSE, k)
        return Image.fromarray(inv)
    except Exception:
        return pil_img


def _clean_captcha_text(text: str) -> str:
    """
    Keep only letters/digits, max 6 chars.
    IMPORTANT: Preserve case (ECI captcha is often lowercase and can be case-sensitive).
    """
    return re.sub(r"[^A-Za-z0-9]", "", (text or "").strip())[:6]


def _ocr_captcha(base64_img: str, expected_len: int | None = 6) -> str:
    """Read captcha from base64 image. EasyOCR first (works without Tesseract); then Tesseract if available."""
    raw = base64_img.split(",")[-1] if "," in base64_img else base64_img
    img_data = base64.b64decode(raw)
    img_bytes = bytes(img_data)

    from PIL import Image
    with io.BytesIO(img_bytes) as buf:
        img_orig = Image.open(buf).copy()
    # Debug artifacts: helps confirm if capture is correct and OCR preprocessing is working.
    try:
        dbg = _get_pdf_folder()
        (dbg / "captcha.png").write_bytes(img_bytes)
    except Exception:
        pass
    img_prep = _preprocess_captcha_image(img_orig, strong=True)
    img_prep_light = _preprocess_captcha_image(img_orig, strong=False)
    img_cv2 = _preprocess_captcha_cv2(img_orig, fixed_threshold=True)
    img_cv2_otsu = _preprocess_captcha_cv2(img_orig, fixed_threshold=False)
    img_cv2_adapt = _preprocess_captcha_cv2_adaptive(img_orig)
    img_cv2_green = _preprocess_captcha_cv2_green_mask(img_orig)
    try:
        dbg = _get_pdf_folder()
        img_cv2.save(dbg / "processed_captcha.png")
    except Exception:
        pass
    candidates = []
    last_error = None

    def _is_bad_candidate(cleaned: str) -> bool:
        # Avoid false positives from labels like "Captcha".
        return (cleaned or "").strip().lower() in ("captcha", "captch")

    def _add_candidate(cleaned: str) -> None:
        if cleaned and not _is_bad_candidate(cleaned) and cleaned not in candidates:
            candidates.append(cleaned)

    def _accept(cleaned: str) -> bool:
        if not cleaned:
            return False
        if expected_len is None:
            # Download captcha is typically 5 or 6; reject junk.
            return len(cleaned) in (5, 6)
        return len(cleaned) == int(expected_len)

    # 1) EasyOCR: try multiple preprocess variants
    try:
        import numpy as np
        reader = _get_easyocr_reader()
        for img_use in (img_cv2_green, img_cv2_adapt, img_cv2, img_cv2_otsu, img_prep, img_prep_light, img_orig):
            img_arr = np.array(img_use)
            results = reader.readtext(img_arr, detail=1)
            if not results:
                continue
            results.sort(key=lambda r: (r[0][0][0], r[0][0][1]))
            for min_conf in (0.3, 0.2):
                parts = []
                for r in results:
                    text_part = r[1]
                    conf = r[2] if len(r) > 2 else 1.0
                    if conf >= min_conf:
                        parts.append(text_part)
                text = "".join(parts)
                cleaned = _clean_captcha_text(text)
                if _accept(cleaned):
                    _add_candidate(cleaned)
                if cleaned:
                    _add_candidate(cleaned)
            if candidates:
                break
    except Exception as e2:
        last_error = e2
        logger.warning("EasyOCR captcha failed: %s", e2)

    # 2) Tesseract if available (accept 3-6 chars; whitelist letters and digits)
    _whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

    def _try_tesseract(tesseract_cmd=None):
        nonlocal last_error
        try:
            import pytesseract
            if tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
            for img_t in (img_cv2_green, img_cv2_adapt, img_cv2, img_cv2_otsu, img_prep, img_prep_light):
                for psm in (8, 7, 6):
                    try:
                        text = pytesseract.image_to_string(
                            img_t,
                            config=f"--psm {psm} -c tessedit_char_whitelist={_whitelist}",
                        )
                        cleaned = _clean_captcha_text(text)
                        if _accept(cleaned):
                            _add_candidate(cleaned)
                    except Exception as te:
                        last_error = te
        except Exception as e3:
            last_error = e3

    if not candidates:
        if sys.platform == "win32":
            for exe in (TESSERACT_EXE_WINDOWS, r"C:\Program Files\Tesseract-OCR\tesseract.exe", r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"):
                if exe and os.path.isfile(exe):
                    _try_tesseract(exe)
                    if candidates:
                        break
            if not candidates:
                _try_tesseract(None)  # use PATH
        else:
            _try_tesseract(None)  # non-Windows: use PATH

    if candidates:
        # Prefer expected length first (usually 6), then longer.
        if expected_len is not None:
            exact = [c for c in candidates if len(c) == int(expected_len)]
            if exact:
                return max(exact, key=lambda c: (len(c), c))
        else:
            # Prefer common captcha lengths.
            for L in (6, 5, 4, 3):
                exact = [c for c in candidates if len(c) == L]
                if exact:
                    return max(exact, key=lambda c: (len(c), c))
        return max(candidates, key=lambda c: (len(c), c))
    err_msg = (
        "Captcha OCR failed (EasyOCR/Tesseract not available or could not read the image). "
        "Use the 'Enter captcha manually' option: check that option and type the captcha in the browser. "
        "To enable OCR: pip install easyocr (or install Tesseract and add to PATH). "
        "Check backend/pdf/captcha.png and backend/pdf/processed_captcha.png for debugging."
    )
    if last_error:
        err_msg += f" Detail: {type(last_error).__name__}: {last_error}"
    raise RuntimeError(err_msg)


def _get_pdf_folder() -> Path:
    """Return backend/pdf folder path. Create if missing."""
    folder = Path(__file__).resolve().parent.parent / "pdf"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def safe_folder_name(name: str) -> str:
    """
    Convert folder names safely:
    - Remove special characters
    - Replace spaces with underscore
    """
    s = (name or "").strip()
    s = re.sub(r'[<>:"/\\|?*]', "", s)
    s = re.sub(r"\s+", "_", s).strip("_")
    return s or "unknown"


def _get_download_output_folder(
    state: str, revyear: str, roll_type: str, district: str, ac_name: str
) -> Path:
    """
    Return:
    backend/download/<state>/<year>/<district>/<assembly>/
    """
    base = Path(__file__).resolve().parent.parent / BASE_DOWNLOAD_DIR
    folder = (
        base
        / safe_folder_name(state)
        / safe_folder_name(revyear)
        / safe_folder_name(district)
        / safe_folder_name(ac_name)
    )
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _save_pdf_file(file_path: Path, pdf_bytes: bytes) -> str:
    """Save PDF bytes using open(..., 'wb') and return full path."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
    return str(file_path)


def save_pdf_with_structure(
    state: str,
    year: str,
    roll_type: str,
    district: str,
    ac_name: str,
    file_name: str,
    pdf_bytes: bytes,
) -> str:
    """
    Creates folder structure:
    State/Year/District/AC/
    and saves the PDF file.
    Returns full saved file path.
    """
    full_path = _get_download_output_folder(
        state=state,
        revyear=str(year),
        roll_type=roll_type,
        district=district,
        ac_name=ac_name,
    )
    file_path = full_path / file_name
    return _save_pdf_file(file_path, pdf_bytes)


def _select_language_preferred(page, state: str, preferred_language: str = "") -> None:
    """
    Select language on ECI page. If preferred_language is given (e.g. "English", "Tamil"),
    try to select that first; otherwise prefer English then fall back to state language.

    Note: On some ECI sessions selecting English (ENG/ENGLISH) can redirect to /login.
    If that happens in your environment, set AUTO_LANGUAGE_FALLBACK_TO_ENGLISH=False.
    """
    page.wait_for_timeout(500)

    # User-selected language name -> ECI value (ENG, TAMIL, etc.)
    preferred_lang_value = None
    if (preferred_language or "").strip():
        pl = (preferred_language or "").strip().lower()
        if pl in ("english", "eng"):
            preferred_lang_value = "ENG"
        elif pl in ("tamil",):
            preferred_lang_value = "TAMIL"
        elif pl in ("kannada",):
            preferred_lang_value = "KANNADA"
        elif pl in ("hindi",):
            preferred_lang_value = "HINDI"
        elif pl in ("telugu",):
            preferred_lang_value = "TELUGU"
        elif pl in ("malayalam",):
            preferred_lang_value = "MALAYALAM"
        elif "state" in pl or "auto" in pl:
            preferred_lang_value = None  # use state/auto logic below

    # Best-effort mapping; ECI labels may vary by roll type.
    state_lang_map = {
        "tamil nadu": "TAMIL",
        "andhra pradesh": "TELUGU",
        "telangana": "TELUGU",
        "karnataka": "KANNADA",
        "kerala": "MALAYALAM",
        "maharashtra": "MARATHI",
        "gujarat": "GUJARATI",
        "west bengal": "BENGALI",
        "odisha": "ODIA",
        "punjab": "PUNJABI",
        "bihar": "HINDI",
        "uttar pradesh": "HINDI",
        "delhi": "HINDI",
        "rajasthan": "HINDI",
        "madhya pradesh": "HINDI",
        "assam": "ASSAMESE",
    }
    desired_fallback = state_lang_map.get((state or "").strip().lower())

    selectors = [
        # ECI uses langCd in current markup:
        'select[name="langCd"]',
        # Other variants we've seen:
        'select[name="language"]',
        'select[name="lang"]',
        'select[id*="language"]',
        'select[id*="lang"]',
        '[name="langCd"]',
        '[name="language"]',
        '[name="lang"]',
    ]

    for selector in selectors:
        el = page.locator(selector).first
        if el.count() == 0:
            continue

        # 1) If user chose a specific language, try that first; else prefer English
        try_first = preferred_lang_value if preferred_lang_value else ("ENG" if AUTO_LANGUAGE_FALLBACK_TO_ENGLISH else None)
        if try_first:
            # ECI often renders the dropdown immediately but hydrates the options a few seconds later.
            for _ in range(20):  # ~10s
                try:
                    el.select_option(value=try_first)
                    logger.info("Selected language (value=%s)", try_first)
                    # ECI sometimes flips the dropdown a few seconds later (React re-render / hydration).
                    # Freeze it to the selected value so it remains selected.
                    try:
                        page.evaluate(
                            """(desiredVal) => {
                                window.__eciFreezeLangDesired = (desiredVal || 'ENG').toString().toUpperCase();
                                if (window.__eciFreezeLangInstalled) return;
                                window.__eciFreezeLangInstalled = true;
                                const pick = () => (
                                  document.querySelector('select[name="langCd"]') ||
                                  document.querySelector('select[name="language"]') ||
                                  document.querySelector('select[name="lang"]') ||
                                  document.querySelector('[name="langCd"]') ||
                                  document.querySelector('[name="language"]') ||
                                  document.querySelector('[name="lang"]')
                                );
                                const desired = () => (window.__eciFreezeLangDesired || 'ENG').toString().toUpperCase();
                                const fire = (el) => {
                                  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                  try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                };
                                const enforce = () => {
                                  const sel = pick();
                                  if (!sel || !sel.options) return;
                                  const want = desired();
                                  const has = Array.from(sel.options).some(o => ((o.value || '').toUpperCase() === want));
                                  if (!has) return;
                                  if (((sel.value || '').toUpperCase() !== want)) {
                                    sel.value = want;
                                    fire(sel);
                                  }
                                };
                                const obs = new MutationObserver(() => enforce());
                                obs.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
                                setInterval(enforce, 500);
                                enforce();
                            }""",
                            try_first,
                        )
                    except Exception:
                        pass
                    return
                except Exception:
                    page.wait_for_timeout(500)
            for _ in range(20):  # ~10s
                try:
                    el.select_option(label="ENGLISH")
                    logger.info("Selected language: English (label=ENGLISH)")
                    try:
                        page.evaluate(
                            """() => {
                                window.__eciFreezeLangDesired = 'ENG';
                                if (window.__eciFreezeLangInstalled) return;
                                window.__eciFreezeLangInstalled = true;
                                const pick = () => (
                                  document.querySelector('select[name="langCd"]') ||
                                  document.querySelector('select[name="language"]') ||
                                  document.querySelector('select[name="lang"]') ||
                                  document.querySelector('[name="langCd"]') ||
                                  document.querySelector('[name="language"]') ||
                                  document.querySelector('[name="lang"]')
                                );
                                const desired = () => (window.__eciFreezeLangDesired || 'ENG').toString().toUpperCase();
                                const fire = (el) => {
                                  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                  try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                };
                                const enforce = () => {
                                  const sel = pick();
                                  if (!sel || !sel.options) return;
                                  const want = desired();
                                  const has = Array.from(sel.options).some(o => ((o.value || '').toUpperCase() === want));
                                  if (!has) return;
                                  if (((sel.value || '').toUpperCase() !== want)) {
                                    sel.value = want;
                                    fire(sel);
                                  }
                                };
                                const obs = new MutationObserver(() => enforce());
                                obs.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
                                setInterval(enforce, 500);
                                enforce();
                            }"""
                        )
                    except Exception:
                        pass
                    return
                except Exception:
                    page.wait_for_timeout(500)
            # If ENG isn't present even after waiting, proceed to state-language fallback below.

        # 2) Fall back to state language (if we know it and it exists in options)
        try:
            options = el.locator("option")
            texts = []
            for i in range(min(options.count(), 50)):
                try:
                    texts.append((options.nth(i).inner_text() or "").strip())
                except Exception:
                    pass
        except Exception:
            texts = []

        if desired_fallback:
            for t in texts:
                if t and t.strip().lower() == desired_fallback.strip().lower():
                    try:
                        el.select_option(label=t)
                        logger.info("Selected language: %s (state fallback)", t)
                        return
                    except Exception:
                        pass

        # 3) Generic fallback: pick first non-placeholder, non-English option label
        for t in texts:
            tl = (t or "").strip().lower()
            if not t:
                continue
            if "english" in tl:
                continue
            if "select" in tl and "language" in tl:
                continue
            try:
                el.select_option(label=t)
                logger.info("Selected language: %s (generic fallback)", t)
                return
            except Exception:
                continue

        # 4) Last resort: select English if we didn't already.
        if AUTO_LANGUAGE_FALLBACK_TO_ENGLISH:
            for attempt in ("English", "english", "ENGLISH"):
                try:
                    el.select_option(label=attempt)
                    logger.info("Selected language: English (fallback enabled)")
                    return
                except Exception:
                    pass
            for attempt in ("ENG", "en", "EN", "english"):
                try:
                    el.select_option(value=attempt)
                    logger.info("Selected language: English (value=%s, fallback enabled)", attempt)
                    return
                except Exception:
                    pass

        return  # Found element, but couldn't select anything safely.
    # Do not click any "English" links/buttons automatically.


def _select_state(page, state: str) -> bool:
    """Select state using multiple strategies. Returns True if successful."""
    # Wait for form to be ready
    page.wait_for_timeout(1500)
    target_state = (state or "").strip()
    target_state_l = target_state.lower()
    state_code = ECI_STATE_CODES.get(target_state_l, "")

    def _verify_state_selected() -> bool:
        """Return True only if state is actually selected (or district options loaded for that state)."""
        # Check native state select selected option text/value
        for ssel in [
            'select.form-select[name="state"]',
            'select[name="state"]',
            'select[name="stateCode"]',
            'select[id*="stateCode"]',
            'select[id*="state"]',
            'select[aria-label*="State" i]',
        ]:
            sel = page.locator(ssel).first
            if sel.count() == 0:
                continue
            try:
                checked = sel.locator("option:checked").first
                txt = (checked.inner_text() or "").strip().lower()
                val = (checked.get_attribute("value") or "").strip().lower()
                if txt and target_state_l in txt:
                    return True
                if state_code and state_code.lower() in val:
                    return True
            except Exception:
                continue
        # Fallback signal: district list loaded with real options (beyond placeholder)
        try:
            dsel = page.locator('select.form-select[name="district"], select[name="district"]').first
            if dsel.count() > 0 and dsel.locator("option").count() > 2:
                return True
        except Exception:
            pass
        return False

    # Try 1: native select (various possible names/ids)
    for selector in [
        'select.form-select[name="state"]',
        'select[name="state"]',
        'select[name="stateCode"]',
        'select[id*="stateCode"]',
        'select[id*="state"]',
        'select[aria-label*="State" i]',
        '[name="stateCode"]',
    ]:
        el = page.locator(selector).first
        if el.count() > 0:
            try:
                el.select_option(label=target_state)
                page.wait_for_timeout(700)
                if _verify_state_selected():
                    return True
            except Exception:
                pass
            try:
                el.select_option(value=target_state)
                page.wait_for_timeout(700)
                if _verify_state_selected():
                    return True
            except Exception:
                pass
            if state_code:
                try:
                    el.select_option(value=state_code)
                    page.wait_for_timeout(700)
                    if _verify_state_selected():
                        return True
                except Exception:
                    pass
            # keep trying other selectors if this one did not actually select state

    # Try 2: react-select / custom dropdown - first input in a combobox or with react-select id
    for input_selector in [
        '[id*="react-select"][id*="-input"]',
        'input[role="combobox"]',
        'div[class*="control"] input',
        'input[placeholder*="State" i]',
        'input[placeholder*="Select" i]',
        'input[aria-label*="state" i]',
    ]:
        inp = page.locator(input_selector).first
        if inp.count() > 0:
            try:
                inp.click(timeout=10000)
                page.wait_for_timeout(500)
                inp.fill(target_state, timeout=5000)
                page.wait_for_timeout(800)
                page.keyboard.press("Enter")
                page.wait_for_timeout(1200)
                if _verify_state_selected():
                    return True
            except Exception:
                pass

    # Try 3: click by label (form field labeled "State")
    try:
        control = page.get_by_label("State", exact=False).first
        if control.count() > 0:
            control.click(timeout=10000)
            page.wait_for_timeout(500)
            page.keyboard.type(target_state, delay=80)
            page.wait_for_timeout(1000)
            page.keyboard.press("Enter")
            page.wait_for_timeout(1200)
            if _verify_state_selected():
                return True
    except Exception:
        pass

    # Try 4: click dropdown container to open menu, then click option (react-select opens on container click)
    try:
        container = page.locator('div[class*="control"]').first
        if container.count() > 0:
            container.click(timeout=10000)
            page.wait_for_timeout(800)
            option = page.get_by_role("option", name=target_state).or_(page.get_by_text(target_state, exact=True)).first
            option.click(timeout=10000)
            page.wait_for_timeout(1200)
            if _verify_state_selected():
                return True
    except Exception:
        pass

    # Try 5: click visible option text (e.g. already open menu)
    try:
        page.get_by_text(target_state, exact=True).first.click(timeout=15000)
        page.wait_for_timeout(1200)
        if _verify_state_selected():
            return True
    except Exception:
        pass

    return False


def _select_district(page, district_name: str, pdf_folder: Path) -> None:
    """
    Select district. Try native select first (ECI may use select[name='district'] with label text),
    then react-select or generic dropdown input.
    """
    try:
        logger.info("Selecting district: %s", district_name)
        # 1) Native <select name="district"> — prefer exact ECI district select.
        # If this exists, do NOT fall back to typing into generic inputs (prevents typing into constituency field).
        native_select_found = False
        try:
            district_select = page.locator(
                'select.form-select[name="district"], '
                'select[name="district"]'
            ).first
            if district_select.count() > 0:
                native_select_found = True
                district_select.wait_for(state="visible", timeout=10000)
                page.wait_for_timeout(1000)
                # Wait for options to load (dynamic after state/roll-type selection).
                # Use polling instead of a hard wait_for_selector timeout to avoid brittle failures.
                options_ready = False
                for _ in range(40):  # ~20s
                    try:
                        opt_count = district_select.locator("option").count()
                        # placeholder + at least one real district option
                        if opt_count > 1:
                            options_ready = True
                            break
                    except Exception:
                        pass
                    page.wait_for_timeout(500)
                if not options_ready:
                    # One more attempt via page-level selector before failing.
                    try:
                        page.wait_for_selector(
                            'select.form-select[name="district"] option, select[name="district"] option',
                            timeout=10000,
                        )
                        options_ready = True
                    except Exception:
                        options_ready = False
                if not options_ready:
                    raise RuntimeError("District options did not load in time")
                page.wait_for_timeout(500)
                # Build option map once so we can do robust, case-insensitive matching.
                opts = district_select.locator("option")
                option_count = opts.count()
                option_pairs = []
                for i in range(option_count):
                    try:
                        o = opts.nth(i)
                        option_pairs.append(((o.inner_text() or "").strip(), (o.get_attribute("value") or "").strip()))
                    except Exception:
                        continue
                target = (district_name or "").strip().lower()
                try:
                    district_select.select_option(label=district_name)
                    logger.info("District selected via native select (label=%s)", district_name)
                    return
                except Exception:
                    pass
                try:
                    district_select.select_option(value=district_name)
                    logger.info("District selected via native select (value=%s)", district_name)
                    return
                except Exception:
                    pass
                # Exact label match (case-insensitive)
                for lbl, val in option_pairs:
                    if lbl.lower() == target and val:
                        district_select.select_option(value=val)
                        logger.info("District selected via option map exact label: %s -> %s", lbl, val)
                        return
                # Partial label match (case-insensitive)
                for lbl, val in option_pairs:
                    l = lbl.lower()
                    if target and (target in l or l in target) and val:
                        district_select.select_option(value=val)
                        logger.info("District selected via option map partial label: %s -> %s", lbl, val)
                        return
                # Known ECI TN value fallback for Chennai
                if target == "chennai":
                    try:
                        district_select.select_option(value="S2202")
                        logger.info("District selected via known ECI value for Chennai (S2202)")
                        return
                    except Exception:
                        try:
                            # JS fallback for stubborn/select2-like wrappers
                            ok = page.evaluate(
                                """(sel) => {
                                    const el = document.querySelector(sel);
                                    if (!el) return false;
                                    el.value = 'S2202';
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    return true;
                                }""",
                                'select.form-select[name="district"], select[name="district"]'
                            )
                            if ok:
                                logger.info("District selected via JS fallback for Chennai (S2202)")
                                return
                        except Exception:
                            pass
                # Native district select exists but we couldn't select required district.
                # Stop here instead of typing into other inputs (which can hit constituency field by mistake).
                raise RuntimeError(
                    f"District select found, but could not select district '{district_name}'. "
                    "Available options did not match."
                )
        except Exception as e:
            if native_select_found:
                raise
            logger.debug("Native district select not used: %s", e)
        # 2) Wait for dropdowns to appear after state selection (react-select)
        try:
            page.wait_for_selector('input[type="text"], [role="combobox"], [id*="react-select"]', timeout=20000)
        except Exception:
            pass
        page.wait_for_timeout(1500)
        # Multiple selectors: ECI may use react-select, or other component libs
        selectors = [
            '[id*="react-select"][id*="-input"]',
            'input[id*="react-select"]',
            'input[placeholder*="District"]',
            'input[placeholder*="district"]',
            'input[placeholder*="Select"]',
            '[role="combobox"]',
            'input[aria-label*="district" i]',
            'input[aria-label*="District"]',
            'form input[type="text"]',  # fallback: any text input in form (state=0, district=1, ac=2)
        ]
        inputs = None
        for selector in selectors:
            try:
                loc = page.locator(selector)
                page.wait_for_timeout(500)
                if loc.count() >= 1:
                    inputs = loc
                    logger.info("District inputs found with selector: %s (count=%d)", selector, loc.count())
                    break
            except Exception:
                continue
        if inputs is None or inputs.count() == 0:
            raise RuntimeError("No district dropdown input found on page.")
        page.wait_for_timeout(2000)
        count = inputs.count()
        if count == 0:
            raise RuntimeError("District dropdown input not found (0 inputs).")
        logger.info("Found %d dropdown inputs", count)
        # After state: 1 input = district only; 2+ = state(0), district(1)
        district_idx = 1 if count >= 2 else 0
        district_input = inputs.nth(district_idx)
        try:
            district_input.wait_for(state="visible", timeout=15000)
        except Exception:
            pass
        for attempt in range(2):
            try:
                district_input.scroll_into_view_if_needed(timeout=5000)
                page.wait_for_timeout(500)
                district_input.click(timeout=10000)
                page.wait_for_timeout(800)
                district_input.fill("")
                page.wait_for_timeout(300)
                district_input.fill(district_name, timeout=5000)
                page.wait_for_timeout(1500)
                # Try to click the option if it appears in the menu (react-select dropdown)
                try:
                    opt = page.get_by_role("option", name=district_name).first
                    if opt.count() > 0:
                        opt.click(timeout=5000)
                    else:
                        page.keyboard.press("Enter")
                except Exception:
                    page.keyboard.press("Enter")
                page.wait_for_timeout(2000)
                logger.info("District selected successfully")
                return
            except Exception as attempt_e:
                if attempt == 0:
                    logger.warning("District selection attempt 1 failed: %s", attempt_e)
                    page.wait_for_timeout(2000)
                else:
                    raise
    except Exception as e:
        try:
            page.screenshot(path=str(pdf_folder / "debug_district_fail.png"))
        except Exception:
            pass
        raise RuntimeError(f"District selection failed. {e}") from e


def _ac_name_for_match(ac_name: str) -> str:
    """
    ECI portal may show different AC numbers than our app (e.g. app "71 - Sankarapuram" vs ECI "79 - Sankarapuram").
    Return the name part for matching (e.g. "Sankarapuram") so we can select by name regardless of number.
    """
    s = (ac_name or "").strip()
    # Strip leading "N - " or "NN - " (number + " - ") so "71 - Sankarapuram" -> "Sankarapuram"
    m = re.match(r"^\d+\s*-\s*(.+)$", s)
    return m.group(1).strip() if m else s


def _select_ac(page, ac_name: str, pdf_folder: Path) -> None:
    """
    Select Assembly Constituency. AC is last react-select (index 2 if 3 inputs, else last).
    Matches by full label first; if not found, matches by AC name only (e.g. Sankarapuram) so app "71 - Sankarapuram"
    still selects ECI option "79 - Sankarapuram".
    """
    ac_match_name = _ac_name_for_match(ac_name)
    try:
        logger.info("Selecting AC (Assembly Constituency)...")

        # 0) If AC is rendered as a native <select>, use it (most reliable).
        native_select = page.locator(
            "select[name*='assembly' i], select[id*='assembly' i], "
            "select[name*='ac' i], select[id*='ac' i]"
        ).first
        if native_select.count() > 0:
            try:
                native_select.wait_for(state="visible", timeout=8000)
            except Exception:
                pass
            try:
                native_select.scroll_into_view_if_needed(timeout=5000)
            except Exception:
                pass
            try:
                native_select.select_option(label=ac_name)
            except Exception:
                # App may use "71 - Sankarapuram", ECI may use "79 - Sankarapuram"; match by name part.
                opts = native_select.locator("option").all()
                picked = None
                for o in opts:
                    try:
                        t = (o.inner_text() or "").strip()
                    except Exception:
                        t = ""
                    if not t:
                        continue
                    tl = t.lower()
                    if ac_name.lower() in tl:
                        picked = t
                        break
                    if ac_match_name and ac_match_name.lower() in tl:
                        picked = t
                        break
                if picked:
                    native_select.select_option(label=picked)
                else:
                    raise
            page.wait_for_timeout(1500)
            logger.info("AC selected successfully (native <select>)")
            return

        # 1) React-select path: target the AC field specifically (don't assume "last input").
        ac_input = None

        # Prefer: label/text "Assembly Constituency" then following react-select input.
        for label_sel in (
            "label:has-text('Assembly Constituency')",
            "text=Assembly Constituency",
            "text=Assembly constituency",
        ):
            try:
                lab = page.locator(label_sel).first
                if lab.count() == 0:
                    continue
                candidate = lab.locator("xpath=following::input[contains(@id,'react-select')][1]").first
                if candidate.count() > 0:
                    ac_input = candidate
                    break
            except Exception:
                continue

        # Fallback: scope to the top controls container that contains the Download button.
        if ac_input is None:
            container = page.locator(
                "form:has(button:has-text('Download Selected PDFs')), "
                "div:has(button:has-text('Download Selected PDFs'))"
            ).first
            scoped = container.locator('[id*="react-select"][id*="-input"], input[id*="react-select"]') if container.count() > 0 else None
            if scoped is not None and scoped.count() > 0:
                # Heuristic: AC input is typically after District input, so pick the last inside this container.
                ac_input = scoped.nth(scoped.count() - 1)

        # Last resort: any visible react-select input, but pick the last visible one.
        if ac_input is None:
            inputs = page.locator('[id*="react-select"][id*="-input"], input[id*="react-select"]')
            visible = []
            for i in range(min(inputs.count(), 8)):
                it = inputs.nth(i)
                try:
                    if it.is_visible():
                        visible.append(it)
                except Exception:
                    continue
            if visible:
                ac_input = visible[-1]

        if ac_input is None or ac_input.count() == 0:
            raise RuntimeError("AC input not found (native select and react-select both missing).")

        # 2) Click/fill with retries (React can re-render and detach).
        try:
            ac_input.wait_for(state="visible", timeout=15000)
        except Exception:
            pass
        for attempt in range(3):
            try:
                try:
                    ac_input.scroll_into_view_if_needed(timeout=5000)
                except Exception:
                    pass
                page.wait_for_timeout(250)
                try:
                    ac_input.click(timeout=10000)
                except Exception:
                    # If covered/blocked, force click as a fallback.
                    ac_input.click(timeout=10000, force=True)
                page.wait_for_timeout(500)
                try:
                    ac_input.fill("")
                except Exception:
                    pass
                # Type by name so ECI options like "79 - Sankarapuram" match when app sent "71 - Sankarapuram"
                fill_text = ac_match_name if ac_match_name else ac_name
                ac_input.fill(fill_text, timeout=8000)
                page.wait_for_timeout(1200)
                # Click option: exact match first, then any option containing the AC name.
                try:
                    opt = page.get_by_role("option", name=ac_name).first
                    if opt.count() > 0:
                        opt.click(timeout=5000)
                    else:
                        opt = page.get_by_role("option", name=ac_match_name).first
                        if opt.count() > 0:
                            opt.click(timeout=5000)
                        else:
                            # ECI may show "79 - Sankarapuram"; click option that contains the name.
                            opt = page.locator(f'[role="option"]:has-text("{ac_match_name}")').first
                            if opt.count() > 0:
                                opt.click(timeout=5000)
                            else:
                                page.keyboard.press("Enter")
                except Exception:
                    page.keyboard.press("Enter")
                page.wait_for_timeout(2500)
                logger.info("AC selected successfully")
                return
            except Exception as e:
                if attempt < 2:
                    logger.warning("AC selection attempt %d failed: %s", attempt + 1, e)
                    page.wait_for_timeout(1500)
                    continue
                raise
    except Exception as e:
        try:
            page.screenshot(path=str(pdf_folder / "debug_ac_fail.png"))
        except Exception:
            pass
        raise RuntimeError(f"AC selection failed. {e}") from e


def download_eci_roll_sync(
    state: str = DEFAULT_STATE,
    revyear: str = DEFAULT_REVYEAR,
    district: str = DEFAULT_DISTRICT,
    ac_name: str = DEFAULT_AC_NAME,
    language: str = "English",
    timeout_ms: int = 120000,
    manual_captcha: bool = True,
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Use Playwright SYNC API to automate ECI electoral roll download.
    Avoids asyncio entirely, so no Windows subprocess/event-loop conflict.
    Returns (pdf_bytes, error_message). If success, pdf_bytes is not None.
    Saves PDF to backend/pdf folder.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None, (
            "Playwright not installed. Run: pip install playwright && playwright install chromium"
        )

    # Working folder for debug/temp batches
    pdf_folder = _get_pdf_folder()
    # Final output path will be set after roll type is selected
    pdf_path = pdf_folder / f"eci_electoral_roll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf_bytes = None
    error_msg = None

    with sync_playwright() as p:
        context = None
        user_data_dir = None
        try:
            pdf_folder.mkdir(parents=True, exist_ok=True)
            # Fresh profile per run to avoid "Opening in existing browser session" / TargetClosedError
            # (reusing a profile dir that is locked or in use causes Chrome to close immediately)
            user_data_dir = Path(tempfile.mkdtemp(prefix="playwright_eci_"))
            launch_args = dict(
                user_data_dir=str(user_data_dir),
                headless=False,
                slow_mo=80,
                accept_downloads=True,
                # Ensure Chrome downloads go under backend/download (not the user's default Downloads).
                downloads_path=str((Path(__file__).resolve().parent.parent / BASE_DOWNLOAD_DIR).resolve()),
                no_viewport=True,
                # Reduce noisy Chrome logging in the terminal where possible.
                args=["--start-maximized", "--disable-logging", "--log-level=3"],
                chromium_sandbox=True,
                ignore_default_args=["--enable-automation"],
                # ECI sometimes has over-restrictive CSP that blocks their own inline scripts;
                # bypassing CSP makes automation more stable.
                bypass_csp=True,
            )
            try:
                context = p.chromium.launch_persistent_context(channel="chrome", **launch_args)
            except Exception as launch_e:
                logger.warning("Chrome launch failed (%s), trying bundled Chromium", launch_e)
                context = p.chromium.launch_persistent_context(**launch_args)
            context.set_default_timeout(timeout_ms)
            if context.pages:
                page = context.pages[0]
            else:
                page = context.new_page()
            page.set_default_timeout(timeout_ms)

            # Enforce English language from the moment the page hydrates.
            # ECI often defaults to state language and then flips to English (or vice-versa) after a few seconds.
            # Installing this as an init script prevents the "auto-change after 5 seconds" behavior.
            try:
                context.add_init_script(
                    """() => {
                        window.__eciFreezeLangDesired = 'ENG';
                        if (window.__eciFreezeLangInitInstalled) return;
                        window.__eciFreezeLangInitInstalled = true;

                        const pick = () => (
                          document.querySelector('select[name="langCd"]') ||
                          document.querySelector('select[name="language"]') ||
                          document.querySelector('select[name="lang"]') ||
                          document.querySelector('[name="langCd"]') ||
                          document.querySelector('[name="language"]') ||
                          document.querySelector('[name="lang"]')
                        );
                        const desired = () => (window.__eciFreezeLangDesired || 'ENG').toString().toUpperCase();
                        const fire = (el) => {
                          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                        };
                        const enforce = () => {
                          const sel = pick();
                          if (!sel || !sel.options) return;
                          const want = desired();
                          const has = Array.from(sel.options).some(o => ((o.value || '').toUpperCase() === want));
                          if (!has) return; // options not hydrated yet
                          if (((sel.value || '').toUpperCase() !== want)) {
                            sel.value = want;
                            fire(sel);
                          }
                        };
                        const obs = new MutationObserver(() => enforce());
                        obs.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
                        setInterval(enforce, 300);
                        enforce();
                    }"""
                )
            except Exception:
                # Non-fatal; language selection will still be attempted later.
                pass

            # Visible helper cursor so you can follow automation actions.
            def _install_helper_cursor():
                try:
                    page.evaluate(
                        """() => {
                            if (window.__eciHelperCursorInstalled) return;
                            window.__eciHelperCursorInstalled = true;
                            const el = document.createElement('div');
                            el.id = '__eci_helper_cursor';
                            el.style.position = 'fixed';
                            el.style.left = '0px';
                            el.style.top = '0px';
                            el.style.width = '14px';
                            el.style.height = '14px';
                            el.style.borderRadius = '2px';
                            el.style.background = 'rgba(255, 64, 64, 0.9)';
                            el.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.8)';
                            el.style.zIndex = '2147483647';
                            el.style.pointerEvents = 'none';
                            el.style.transform = 'translate(-50%, -50%)';
                            // Small "hand" style pointer by adding a triangle.
                            const tri = document.createElement('div');
                            tri.style.position = 'absolute';
                            tri.style.left = '12px';
                            tri.style.top = '8px';
                            tri.style.width = '0';
                            tri.style.height = '0';
                            tri.style.borderTop = '6px solid transparent';
                            tri.style.borderBottom = '6px solid transparent';
                            tri.style.borderLeft = '10px solid rgba(255, 64, 64, 0.9)';
                            tri.style.pointerEvents = 'none';
                            el.appendChild(tri);
                            document.documentElement.appendChild(el);
                            window.__eciMoveHelperCursor = (x, y) => {
                                const c = document.getElementById('__eci_helper_cursor');
                                if (!c) return;
                                c.style.left = `${x}px`;
                                c.style.top = `${y}px`;
                            };
                        }"""
                    )
                except Exception:
                    pass

            def _cursor_move_to(locator):
                try:
                    box = locator.bounding_box()
                    if not box:
                        return
                    x = box["x"] + box["width"] / 2
                    y = box["y"] + box["height"] / 2
                    try:
                        page.evaluate("([x,y]) => window.__eciMoveHelperCursor && window.__eciMoveHelperCursor(x,y)", [x, y])
                    except Exception:
                        pass
                    try:
                        page.mouse.move(x, y, steps=12)
                    except Exception:
                        pass
                except Exception:
                    pass

            def _cursor_click(locator, timeout=10000):
                _cursor_move_to(locator)
                locator.click(timeout=timeout)

            _install_helper_cursor()

            # ECI occasionally serves this font CSS URL with an incorrect MIME type (text/html),
            # which triggers a strict-MIME console error. We don't need it for automation,
            # so stub it as empty CSS. Route at CONTEXT level for reliability.
            try:
                def _stub_css(route, request):
                    try:
                        route.fulfill(status=200, content_type="text/css", body="/* stubbed by automation */\n")
                    except Exception:
                        # Best-effort; don't fail the run if routing is unavailable for any reason.
                        route.continue_()

                context.route("**/*cdac-gist-fonts.css*", _stub_css)
            except Exception:
                pass

            # 1. Navigate without statecode so react-select indices are always 0=state, 1=district, 2=AC
            logger.info("Navigating to ECI download page...")
            for goto_attempt in range(2):
                try:
                    page.goto(ECI_DOWNLOAD_URL, wait_until="domcontentloaded", timeout=90000)
                    break
                except Exception as goto_e:
                    err_str = str(goto_e).lower()
                    if "err_internet_disconnected" in err_str or "err_connection" in err_str or "err_network" in err_str:
                        if goto_attempt == 0:
                            logger.warning("Network error on first goto, retrying in 3s: %s", goto_e)
                            page.wait_for_timeout(3000)
                            continue
                        return None, (
                            "No internet connection. Please check your network and try again. "
                            "Error: net::ERR_INTERNET_DISCONNECTED or similar."
                        )
                    raise
            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                logger.info("Network idle not reached, continuing...")
            page.wait_for_timeout(6000)
            if not _select_state(page, state):
                return None, f"Could not select state '{state}'."
            # Wait for district dropdown to load (ECI loads it after state selection)
            try:
                page.wait_for_selector('select[name="district"] option, select[id*="district"] option', timeout=18000)
            except Exception:
                page.wait_for_timeout(12000)
            page.wait_for_timeout(2000)

            # 2. Set revyear (can be select or input)
            rev_loc = page.locator('[name="revyear"]').first
            if rev_loc.count() > 0:
                tag = rev_loc.evaluate("el => el.tagName.toLowerCase()")
                if tag == "select":
                    try:
                        rev_loc.select_option(label=revyear)
                    except Exception:
                        rev_loc.select_option(value=revyear)
                else:
                    rev_loc.fill(revyear)

            # 3. Set Roll Type first
            roll_type_name = "Roll Type"
            role_select = page.locator('select[name="roleType"], [name="roleType"]').first
            try:
                role_select.wait_for(state="visible", timeout=8000)
            except Exception:
                pass
            if role_select.count() > 0:
                options = role_select.locator("option").all()
                if options:
                    try:
                        role_select.select_option(index=1)
                        logger.info("Roll Type set automatically (index 1)")
                        try:
                            selected_text = (role_select.locator("option:checked").first.inner_text() or "").strip()
                            if selected_text:
                                roll_type_name = selected_text
                        except Exception:
                            try:
                                selected_text = (role_select.locator("option").nth(1).inner_text() or "").strip()
                                if selected_text:
                                    roll_type_name = selected_text
                            except Exception:
                                pass
                    except Exception as re:
                        logger.warning("Roll Type selection failed (non-fatal): %s", re)
            page.wait_for_timeout(2000)

            # 4. Select District (required) after Roll Type - MUST succeed or we stop
            try:
                page.screenshot(path=str(pdf_folder / "debug_before_district.png"))
            except Exception:
                pass
            try:
                _select_district(page, district, pdf_folder)
            except Exception as e:
                logger.exception("District selection failed")
                try:
                    page.screenshot(path=str(pdf_folder / "debug_district_fail.png"))
                except Exception:
                    pass
                return None, f"District selection failed: {e}"

            page.wait_for_timeout(3500)

            # 5. Select Assembly Constituency - MUST succeed or we stop
            try:
                _select_ac(page, ac_name, pdf_folder)
            except Exception as e:
                logger.exception("AC selection failed")
                return None, f"AC selection failed: {e}"

            page.wait_for_timeout(2000)
            # Final PDF output folder:
            # backend/download/<state>/<year>/<district>/<assembly>/
            output_folder = _get_download_output_folder(
                state=state,
                revyear=revyear,
                roll_type=roll_type_name,
                district=district,
                ac_name=ac_name,
            )
            pdf_path = output_folder / f"eci_electoral_roll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            logger.info("Final output path: %s", pdf_path)
            # 6. Set language after Roll Type -> District -> AC (requested order)
            _select_language_preferred(page, state=state, preferred_language=language or "English")
            page.wait_for_timeout(1000)

            # 7. Captcha + Submit with retry — find block by image + input; then use Search/Show button (not Login)
            parts_table_loaded = False
            captcha_img_sel = 'img[src^="data:image"]'
            captcha_input_sel = 'input[name="captcha"]'
            # Prefer roll Search/Show to avoid redirect to login page
            submit_search_show = (
                'button:has-text("Search"), button:has-text("Show"), '
                'input[value="Search"], input[value="Show"]'
            )
            submit_any_not_login = (
                'button[type="submit"]:not(:has-text("Login")), input[type="submit"]:not(:has-text("Login")), '
                'button:has-text("Submit"):not(:has-text("Login"))'
            )
            for attempt in range(MAX_CAPTCHA_RETRIES):
                logger.info("Captcha attempt %d/%d", attempt + 1, MAX_CAPTCHA_RETRIES)
                page.wait_for_timeout(1200)
                # Block = form or div that has captcha image AND captcha input; fallback = page (ECI may use separate containers)
                block = page.locator("form").filter(has=page.locator(captcha_img_sel)).filter(
                    has=page.locator(captcha_input_sel)
                ).first
                if block.count() == 0:
                    block = page.locator("div").filter(has=page.locator(captcha_img_sel)).filter(
                        has=page.locator(captcha_input_sel)
                    ).first
                use_page_as_block = False
                if block.count() == 0:
                    # Fallback: find captcha input and image anywhere on page (React may render in separate divs)
                    if page.locator(captcha_input_sel).count() > 0 and page.locator(captcha_img_sel).count() > 0:
                        block = page
                if block.count() == 0:
                    try:
                        page.screenshot(path=str(pdf_folder / "debug_no_captcha.png"))
                    except Exception:
                        pass
                    return None, "Captcha block not found (need image and captcha input). Use 'Enter captcha manually' and ensure state/district/AC are selected."
                # Captcha input: name=captcha or placeholder/label for captcha
                cap_input = block.locator(captcha_input_sel).first
                if cap_input.count() == 0:
                    cap_input = block.locator('input[placeholder*="aptcha" i], input[placeholder*="Captcha"], input[id*="captcha"]').first
                if cap_input.count() == 0:
                    return None, "Captcha input not found."
                # Captcha image: prefer alt=captcha, else data:image in block
                captcha_img = block.locator('img[alt="captcha"], img[alt="Captcha"]').first
                if captcha_img.count() == 0:
                    captcha_img = block.locator(captcha_img_sel).last
                if captcha_img.count() == 0:
                    captcha_img = block.locator(captcha_img_sel).first
                try:
                    captcha_img.wait_for(state="visible", timeout=8000)
                except Exception:
                    pass
                if captcha_img.count() == 0:
                    return None, "Captcha image not found."
                page.wait_for_timeout(800)

                # ECI sometimes auto-refreshes captcha (image src changes) when you interact with the page.
                # Freeze the captcha image while the user is typing/working so it doesn't change mid-entry.
                frozen_captcha_src = None
                try:
                    frozen_captcha_src = captcha_img.get_attribute("src")
                except Exception:
                    frozen_captcha_src = None
                if frozen_captcha_src and str(frozen_captcha_src).strip().startswith("data:"):
                    try:
                        page.evaluate(
                            """(src) => {
                                // Install once; update the frozen src each attempt.
                                window.__eciFrozenCaptchaSrc = src;
                                if (window.__eciFreezeCaptchaInstalled) return;
                                window.__eciFreezeCaptchaInstalled = true;
                                const pickImg = () =>
                                    document.querySelector('img[alt="captcha"], img[alt="Captcha"], img[src^="data:image"]');
                                const enforce = () => {
                                    const img = pickImg();
                                    if (!img) return;
                                    const desired = window.__eciFrozenCaptchaSrc;
                                    if (desired && img.getAttribute('src') !== desired) {
                                        img.setAttribute('src', desired);
                                    }
                                };
                                // MutationObserver catches most React re-renders / src updates.
                                const obs = new MutationObserver(() => enforce());
                                obs.observe(document.documentElement, { subtree: true, attributes: true, childList: true });
                                // Interval as a fallback (some updates aren't caught reliably).
                                setInterval(enforce, 500);
                                enforce();
                            }""",
                            str(frozen_captcha_src),
                        )
                    except Exception:
                        pass

                if manual_captcha:
                    # Wait for user to type captcha in the browser (visible window); poll up to 90s
                    _input_timeout_ms = 10000
                    logger.info(
                        "Manual captcha: enter the captcha in the browser window. "
                        "After entering it, click the Search/Show button yourself (do NOT click Login). "
                        "Automation will continue once the parts table appears."
                    )
                    cap_input.scroll_into_view_if_needed()
                    cap_input.click()
                    wait_until = datetime.now().timestamp() + 90
                    typed_val = ""
                    while datetime.now().timestamp() < wait_until:
                        page.wait_for_timeout(1000)
                        try:
                            val = (cap_input.input_value(timeout=_input_timeout_ms) or "").strip()
                        except Exception as e:
                            if "Timeout" in str(e) or "timeout" in str(e).lower():
                                val = ""
                            else:
                                raise
                        # Avoid submitting while the user is still typing.
                        # ECI captcha is typically 6 chars; require full length before we treat it as complete.
                        if len(val) >= 6:
                            typed_val = val
                            logger.info("Manual captcha entered (%d chars).", len(val))
                            break
                    else:
                        return None, "Manual captcha: no input entered within 90 seconds. Enter the captcha in the browser and try again."

                    # IMPORTANT: In manual captcha mode, do NOT auto-click Search/Show/Submit.
                    # Auto-submitting has been causing redirects to /login when the user is still typing,
                    # when the wrong submit button is clicked, or when ECI treats the click as invalid.
                    # The user will click Search/Show manually; we only wait for the table or detect /login.
                    manual_saw_login = False
                    wait_table_until = datetime.now().timestamp() + 120
                    while datetime.now().timestamp() < wait_table_until:
                        page.wait_for_timeout(2000)
                        if "/login" in page.url:
                            manual_saw_login = True
                            try:
                                page.screenshot(path=str(pdf_folder / "debug_login_redirect_after_captcha.png"))
                            except Exception:
                                pass
                            logger.warning("Manual captcha: ECI showed login page (wrong captcha or session). Will go back and re-fill so you can try again.")
                            break
                        if page.locator("table.contenttable-eroll, table.datatable-box").count() > 0:
                            parts_table_loaded = True
                            logger.info("Parts table loaded after manual submit.")
                            break
                    else:
                        if "/login" not in page.url:
                            return None, (
                                "Manual captcha: no parts table after 2 minutes. "
                                "Please click the Search/Show button in the browser after entering the captcha."
                            )
                    if parts_table_loaded:
                        # Once the table is loaded, captcha no longer matters; allow it to refresh again.
                        try:
                            page.evaluate("() => { window.__eciFrozenCaptchaSrc = null; }")
                        except Exception:
                            pass
                        break
                    # Fell through: we're on login page after manual submit — go back and re-fill so user can retry (manual_saw_login is True)
                else:
                    manual_saw_login = False
                    src = captcha_img.get_attribute("src")
                    if not src or not src.strip().startswith("data:"):
                        return None, "Captcha image has no data src."
                    try:
                        captcha_text = _ocr_captcha(src, expected_len=6)
                    except Exception as e:
                        err_text = str(e)
                        if "Enter captcha manually" in err_text:
                            return None, err_text
                        return None, (
                            "Captcha OCR failed. Use the 'Enter captcha manually' option and type the captcha in the browser. "
                            "To enable OCR: pip install easyocr (or install Tesseract). Detail: " + err_text
                        )
                    if not captcha_text:
                        return None, "Captcha OCR returned empty text."
                    if len(captcha_text) < 4:
                        logger.warning("OCR returned short captcha (%d chars): %r", len(captcha_text), captcha_text)
                        try:
                            raw = src.split(",")[-1] if "," in src else src
                            dec = base64.b64decode(raw)
                            (pdf_folder / "debug_captcha_short.png").write_bytes(dec)
                        except Exception:
                            pass
                    cap_input.scroll_into_view_if_needed()
                    cap_input.click()
                    page.wait_for_timeout(200)
                    cap_input.fill("")
                    page.wait_for_timeout(100)
                    page.keyboard.type(captcha_text, delay=80)
                    page.wait_for_timeout(200)
                    try:
                        input_value = cap_input.input_value(timeout=10000) or ""
                    except Exception as e:
                        if "Timeout" in str(e) or "timeout" in str(e).lower():
                            input_value = ""
                        else:
                            raise
                    if not input_value or input_value.strip() != captcha_text.strip():
                        cap_input.fill("")
                        page.wait_for_timeout(50)
                        cap_input.fill(captcha_text)
                        page.wait_for_timeout(100)

                current_url_before = page.url
                if not manual_captcha:
                    # OCR path: Prefer Search/Show (roll), else any submit that is not Login.
                    submit_btn = block.locator(submit_search_show).first
                    if submit_btn.count() == 0:
                        submit_btn = page.locator(submit_search_show).first
                    if submit_btn.count() == 0:
                        submit_btn = block.locator(submit_any_not_login).first
                    if submit_btn.count() == 0:
                        submit_btn = page.locator(
                            'button[type="submit"]:not(:has-text("Login")), input[type="submit"]:not(:has-text("Login"))'
                        ).first
                    if submit_btn.count() == 0:
                        submit_btn = page.locator('button[type="submit"], input[type="submit"]').first
                    if submit_btn.count() == 0:
                        return None, "Submit/Search button not found."
                    # Only click for OCR mode. In manual mode the user (or earlier AUTO_START) triggers submit.
                    if "/login" not in page.url:
                        _cursor_click(submit_btn)
                        page.wait_for_timeout(4000)
                # If we were redirected to login, go back and re-fill form so captcha block appears again (OCR submit or manual path saw login)
                if "/login" in page.url and (("/login" not in (current_url_before or "")) or (manual_captcha and manual_saw_login)):
                    logger.warning("Captcha submit redirected to login page; going back and re-filling form.")
                    # Recovery must be extra defensive: ECI sometimes takes a while to re-render the form
                    # after a redirect, and a single _select_state attempt can fail even though the page
                    # would be usable a couple seconds later.
                    try:
                        page.goto(ECI_DOWNLOAD_URL, wait_until="domcontentloaded", timeout=60000)
                    except Exception:
                        page.goto(ECI_DOWNLOAD_URL, wait_until="load", timeout=60000)
                    page.wait_for_timeout(5000)
                    try:
                        page.wait_for_selector(
                            "select[name='state'], select[name='stateCode'], [name='stateCode'], [aria-label*='State' i]",
                            timeout=20000,
                        )
                    except Exception:
                        pass
                    state_ok = False
                    for attempt_state in range(3):
                        try:
                            if _select_state(page, state):
                                state_ok = True
                                break
                        except Exception:
                            state_ok = False
                        page.wait_for_timeout(4000)
                        # If the form is still mid-render, a soft reload often fixes it.
                        try:
                            page.reload(wait_until="domcontentloaded", timeout=60000)
                        except Exception:
                            pass
                        page.wait_for_timeout(5000)
                    if not state_ok:
                        try:
                            page.screenshot(path=str(pdf_folder / "debug_state_after_login_redirect.png"))
                        except Exception:
                            pass
                        return None, (
                            f"Could not re-select state '{state}' after login redirect. "
                            "See backend/pdf/debug_state_after_login_redirect.png."
                        )
                    page.wait_for_timeout(12000)
                    rev_loc = page.locator('[name="revyear"]').first
                    if rev_loc.count() > 0:
                        try:
                            tag = rev_loc.evaluate("el => el.tagName.toLowerCase()")
                            if tag == "select":
                                try:
                                    rev_loc.select_option(label=revyear)
                                except Exception:
                                    rev_loc.select_option(value=revyear)
                            else:
                                rev_loc.fill(revyear)
                        except Exception:
                            pass
                    role_select = page.locator('select[name="roleType"], [name="roleType"]').first
                    try:
                        role_select.wait_for(state="visible", timeout=8000)
                    except Exception:
                        pass
                    if role_select.count() > 0 and role_select.locator("option").count() > 0:
                        try:
                            role_select.select_option(index=1)
                        except Exception:
                            pass
                    page.wait_for_timeout(2000)
                    try:
                        _select_district(page, district, pdf_folder)
                    except Exception as e:
                        return None, f"Could not re-select district after redirect: {e}"
                    page.wait_for_timeout(3500)
                    try:
                        _select_ac(page, ac_name, pdf_folder)
                    except Exception as e:
                        return None, f"Could not re-select AC after redirect: {e}"
                    page.wait_for_timeout(2000)
                    _select_language_preferred(page, state=state, preferred_language=language or "English")
                    page.wait_for_timeout(1000)
                    continue

                table_count = page.locator("table.contenttable-eroll, table.datatable-box").count()
                if table_count > 0:
                    parts_table_loaded = True
                    logger.info("Parts table loaded successfully")
                    break

                # Debug screenshot after failed submit
                debug_path = pdf_folder / "debug_after_submit.png"
                try:
                    page.screenshot(path=str(debug_path))
                    logger.info("Invalid captcha? Screenshot: %s", debug_path)
                except Exception:
                    pass
                logger.info("Invalid captcha, refreshing (%d/%d)...", attempt + 1, MAX_CAPTCHA_RETRIES)
                refresh_img = block.locator('img[alt="refresh"], img[src*="refresh"]').first
                if refresh_img.count() > 0:
                    refresh_img.click()
                else:
                    captcha_img.click()
                page.wait_for_timeout(1500)

            if not parts_table_loaded:
                return None, (
                    "Could not load parts table after %d captcha attempts. "
                    "ECI often redirects to login when captcha is wrong (even one character). "
                    "Use 'Enter captcha manually' and type the captcha in the browser window — same session, no redirect. "
                    "Check backend/pdf/debug_after_submit.png to see the page after submit (login page = wrong captcha or session)."
                ) % MAX_CAPTCHA_RETRIES

            # 6b. ECI is server-side paginated (10 records per page). Loop all pages: select all on page → download → Next.
            DOWNLOAD_WAIT_MS = 180000
            download_btn = page.locator('button:has-text("Download Selected PDFs"), input[value="Download Selected PDFs"]').first
            if download_btn.count() == 0:
                download_btn = page.locator('button:has-text("Download"), input[value="Download"]').first
            if download_btn.count() == 0:
                download_btn = page.locator('button.submit:has-text("Download")').first
            if download_btn.count() == 0:
                error_msg = "Could not find Download Selected PDFs button"
            else:
                download_btn.scroll_into_view_if_needed()
                page.wait_for_timeout(500)
                try:
                    download_btn.wait_for(state="visible", timeout=10000)
                except Exception:
                    pass
                downloads_collected = []
                all_batch_paths = []
                dl_seq = {"n": 0}

                def _on_download(download):
                    try:
                        downloads_collected.append(download)
                    except Exception as e:
                        logger.debug("Download listener: %s", e)
                    # Save every download into the structured output folder as well.
                    # This covers cases where the browser downloads but our expect_download path misses.
                    try:
                        dl_seq["n"] += 1
                        # Use suggested filename if it ends with .pdf, else force .pdf.
                        try:
                            suggested = (download.suggested_filename or "").strip()
                        except Exception:
                            suggested = ""
                        if suggested.lower().endswith(".pdf"):
                            fname = suggested
                        else:
                            fname = f"{pdf_path.stem}_dl_{dl_seq['n']:03d}.pdf"
                        out_path = output_folder / fname
                        out_path.parent.mkdir(parents=True, exist_ok=True)
                        try:
                            download.save_as(str(out_path))
                        except Exception:
                            # Some downloads require a short delay before save_as works.
                            page.wait_for_timeout(800)
                            download.save_as(str(out_path))
                        # Validate PDF header before adding to merge list.
                        try:
                            head = out_path.read_bytes()[:5]
                        except Exception:
                            head = b""
                        if head == b"%PDF-":
                            all_batch_paths.append(out_path)
                            logger.info("Saved download to %s", out_path)
                    except Exception:
                        # Best-effort; don't break the run for download-save failures.
                        pass

                def _is_pdf_response(response):
                    try:
                        if not response.ok:
                            return False
                        ct = (response.headers.get("content-type") or "").lower()
                        if "application/pdf" in ct:
                            return True
                        url = (response.url() or "").lower()
                        if url.endswith(".pdf"):
                            return True
                        cd = (response.headers.get("content-disposition") or "").lower()
                        if "attachment" in cd and "pdf" in cd:
                            return True
                        return False
                    except Exception:
                        return False

                def _try_save_pdf_from_blob_url(batch_file: Path) -> bool:
                    """
                    Some ECI flows open the PDF inline as a blob: URL in the same tab
                    (e.g. blob:https://voters.eci.gov.in/<uuid>), which does not trigger
                    Playwright's download event. In that case, fetch the blob bytes from
                    inside the page, save them locally, then go back to continue.
                    """
                    try:
                        # Always write a real *.pdf file on disk (Windows/Chrome may hide extensions in UI).
                        try:
                            if batch_file.suffix.lower() != ".pdf":
                                batch_file = batch_file.with_suffix(".pdf")
                        except Exception:
                            pass
                        try:
                            batch_file.parent.mkdir(parents=True, exist_ok=True)
                        except Exception:
                            pass
                        try:
                            page.wait_for_url("blob:**", timeout=6000)
                        except Exception:
                            # URL might already be blob: or might never become blob:
                            pass
                        u = (page.url or "").strip()
                        if not u.startswith("blob:"):
                            return False
                        # Prefer FileReader -> dataURL. This is significantly more reliable for multi-MB PDFs
                        # than building huge JS strings via String.fromCharCode.
                        data_url = page.evaluate(
                            """async (u) => {
                                const res = await fetch(u);
                                const blob = await res.blob();
                                return await new Promise((resolve, reject) => {
                                    const r = new FileReader();
                                    r.onerror = () => reject(new Error('FileReader failed'));
                                    r.onload = () => resolve(r.result);
                                    r.readAsDataURL(blob);
                                });
                            }""",
                            u,
                        )
                        if not data_url or not isinstance(data_url, str) or "base64," not in data_url:
                            return False
                        b64 = data_url.split("base64,", 1)[1]
                        body = base64.b64decode(b64)
                        if not body or len(body) < 100 or body[:5] != b"%PDF-":
                            return False
                        batch_file.write_bytes(body)
                        return True
                    except Exception:
                        return False

                def _rename_extensionless_pdfs_in_download_dir(since_ts: float) -> int:
                    """
                    On this ECI flow, Chrome sometimes saves a PDF into backend/download/ with a UUID-like
                    filename *without* a .pdf extension. The file is valid (%PDF- header) but Windows won't
                    treat it as a PDF by default.
                    Best-effort: rename recent PDF-ish files to end with .pdf.
                    (We also cover cases where Chrome uses a non-.pdf suffix like .bin/.tmp.)
                    """
                    renamed = 0
                    try:
                        base = (Path(__file__).resolve().parent.parent / BASE_DOWNLOAD_DIR).resolve()
                        if not base.exists():
                            return 0
                        for p in base.iterdir():
                            try:
                                if not p.is_file():
                                    continue
                            except Exception:
                                continue
                            # Ignore transient Chrome temp downloads.
                            if p.suffix.lower() == ".crdownload":
                                continue
                            # If it already ends with .pdf, nothing to do.
                            if p.suffix.lower() == ".pdf":
                                continue
                            try:
                                st = p.stat()
                            except Exception:
                                continue
                            # Small slack to account for clock/FS granularity.
                            if st.st_mtime < (since_ts - 2.0):
                                continue
                            # Avoid tiny placeholder files.
                            if st.st_size < 10_000:
                                continue
                            try:
                                with open(p, "rb") as f:
                                    head = f.read(5)
                            except Exception:
                                continue
                            if head != b"%PDF-":
                                continue

                            # Normalize to a real .pdf filename (Windows will open it correctly).
                            # - if extensionless: uuid -> uuid.pdf
                            # - if weird suffix: uuid.bin -> uuid.pdf
                            target = p.with_suffix(".pdf")
                            if target.exists():
                                target = p.with_suffix(f".{int(time.time())}.pdf")
                            try:
                                # Wait briefly for the browser to finish writing.
                                s1 = st.st_size
                                time.sleep(0.25)
                                s2 = p.stat().st_size
                                if s2 != s1:
                                    time.sleep(0.5)
                            except Exception:
                                pass
                            try:
                                p.replace(target)
                                renamed += 1
                            except Exception:
                                # File may be locked by Chrome; ignore.
                                continue
                    except Exception:
                        return renamed
                    return renamed

                def _find_recent_top_level_pdf_in_download_dir(since_ts: float) -> Path | None:
                    """
                    Find a recently written PDF file directly under backend/download/ (top-level only).
                    ECI/Chrome sometimes writes a UUID-named file without an extension here.
                    We use this to "harvest" it into our structured `batch_file` path.
                    """
                    try:
                        base = (Path(__file__).resolve().parent.parent / BASE_DOWNLOAD_DIR).resolve()
                        if not base.exists():
                            return None
                        candidates: list[tuple[float, int, Path]] = []
                        for p in base.iterdir():
                            try:
                                if not p.is_file():
                                    continue
                            except Exception:
                                continue
                            # Ignore transient Chrome temp downloads.
                            if p.suffix.lower() == ".crdownload":
                                continue
                            try:
                                st = p.stat()
                            except Exception:
                                continue
                            if st.st_mtime < (since_ts - 2.0):
                                continue
                            if st.st_size < 10_000:
                                continue
                            try:
                                with open(p, "rb") as f:
                                    head = f.read(5)
                            except Exception:
                                continue
                            if head != b"%PDF-":
                                continue
                            candidates.append((float(st.st_mtime), int(st.st_size), p))
                        if not candidates:
                            return None
                        candidates.sort(key=lambda t: (t[0], t[1]), reverse=True)
                        return candidates[0][2]
                    except Exception:
                        return None

                def _harvest_recent_pdf_from_download_dir(batch_file: Path, since_ts: float) -> bool:
                    """
                    If Chrome saved a PDF into backend/download/ (UUID filename, maybe no extension),
                    move/copy it into our structured `batch_file` location.
                    """
                    try:
                        src = _find_recent_top_level_pdf_in_download_dir(since_ts=since_ts)
                        if src is None:
                            return False
                        # Ensure source is done writing.
                        _wait_for_download_dir_idle(since_ts=since_ts, timeout_s=120)
                        batch_file.parent.mkdir(parents=True, exist_ok=True)
                        moved = False
                        try:
                            shutil.move(str(src), str(batch_file))
                            moved = True
                        except Exception:
                            # If the file is locked by Chrome, fall back to copy, then attempt cleanup.
                            try:
                                shutil.copyfile(str(src), str(batch_file))
                            except Exception:
                                return False

                        ok = False
                        try:
                            ok = batch_file.read_bytes()[:5] == b"%PDF-"
                        except Exception:
                            ok = False
                        if not ok:
                            return False

                        # If we had to copy, try to remove the original UUID file so the user
                        # doesn't end up with random names lying around in backend/download/.
                        if (not moved) and src.exists():
                            try:
                                src.unlink()
                            except Exception:
                                pass
                        return True
                    except Exception:
                        return False

                def _wait_for_download_dir_idle(since_ts: float, timeout_s: int = 90) -> bool:
                    """
                    When Chrome saves into downloads_path it may write a temporary *.crdownload first,
                    or keep growing the final file for a few seconds. If we paginate too early, ECI/Chrome
                    can behave inconsistently (and it also makes the user think page-2 automation "stopped").

                    Wait until:
                    - no recent *.crdownload exists in backend/download/
                    - and recent download files have stable sizes across multiple checks
                    """
                    try:
                        base = (Path(__file__).resolve().parent.parent / BASE_DOWNLOAD_DIR).resolve()
                        if not base.exists():
                            return True
                        deadline = time.time() + max(5, int(timeout_s))
                        prev_sizes: dict[str, int] = {}
                        stable_ticks = 0
                        while time.time() < deadline:
                            # 1) If any crdownload is present, downloads are not done.
                            try:
                                for p in base.iterdir():
                                    if not p.is_file():
                                        continue
                                    if p.suffix.lower() != ".crdownload":
                                        continue
                                    try:
                                        if p.stat().st_mtime >= (since_ts - 2.0):
                                            stable_ticks = 0
                                            time.sleep(0.5)
                                            raise StopIteration
                                    except Exception:
                                        stable_ticks = 0
                                        time.sleep(0.5)
                                        raise StopIteration
                            except StopIteration:
                                continue
                            except Exception:
                                # If we can't read the dir, don't block forever.
                                return True

                            # 2) Sizes stable?
                            recent: list[tuple[str, int]] = []
                            try:
                                for p in base.iterdir():
                                    if not p.is_file():
                                        continue
                                    st = p.stat()
                                    if st.st_mtime >= (since_ts - 2.0):
                                        recent.append((str(p), int(st.st_size)))
                            except Exception:
                                return True

                            if not recent:
                                return True

                            changed = False
                            for key, size in recent:
                                if key in prev_sizes and prev_sizes[key] != size:
                                    changed = True
                                prev_sizes[key] = size

                            if changed:
                                stable_ticks = 0
                            else:
                                stable_ticks += 1
                                if stable_ticks >= 3:  # ~1.5s stable
                                    return True
                            time.sleep(0.5)
                        return False
                    except Exception:
                        return True

                # Manual-mode helper: capture PDF bytes from network responses triggered by user click.
                captured_pdf_response = {"body": None}

                def _on_response_capture_pdf(response):
                    try:
                        if captured_pdf_response["body"] is not None:
                            return
                        if not _is_pdf_response(response):
                            return
                        body = response.body()
                        if body and len(body) > 100 and body[:5] == b"%PDF-":
                            captured_pdf_response["body"] = body
                    except Exception:
                        # Best-effort only.
                        return

                def _safe_check(loc):
                    try:
                        loc.check(timeout=3000)
                    except Exception as e:
                        msg = str(e).lower()
                        if (
                            "did not change its state" in msg
                            or "timeout" in msg
                            or "not attached to the dom" in msg
                            or "detached" in msg
                            or "receives pointer events" in msg
                        ):
                            try:
                                loc.click(timeout=3000)
                            except Exception:
                                loc.click(timeout=3000, force=True)
                        else:
                            raise

                def _safe_uncheck(loc):
                    try:
                        loc.uncheck(timeout=3000)
                    except Exception as e:
                        msg = str(e).lower()
                        if (
                            "did not change its state" in msg
                            or "timeout" in msg
                            or "not attached to the dom" in msg
                            or "detached" in msg
                            or "receives pointer events" in msg
                        ):
                            try:
                                loc.click(timeout=3000)
                            except Exception:
                                loc.click(timeout=3000, force=True)
                        else:
                            raise

                def _install_download_click_guard():
                    """
                    Prevent ECI warnings when the user clicks Download with >10 (or 0) selected.
                    Instead, the click becomes a "start download" signal; automation will then
                    enforce a safe selection (<=10) and trigger the real click.
                    """
                    try:
                        page.evaluate(
                            """() => {
                                if (window.__eciDownloadGuardInstalled) return;
                                window.__eciDownloadGuardInstalled = true;
                                window.__eciUserRequestedDownload = false;
                                window.__eciAllowAutomationClick = false;
                                window.__eciLastDownloadGuardReason = null;
                                window.__eciSelectAllMode = false;

                                const isDownloadEl = (t) => {
                                    if (!t || !t.closest) return false;
                                    const btn = t.closest('button');
                                    if (btn && /download\\s+selected\\s+pdfs/i.test(btn.innerText || '')) return true;
                                    const inp = t.closest('input');
                                    if (inp && /download\\s+selected\\s+pdfs/i.test(inp.value || '')) return true;
                                    return false;
                                };
                                const nearestVisibleCaptchaInputTo = (btnEl) => {
                                    const inputs = Array.from(document.querySelectorAll(
                                      "input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]"
                                    )).filter(el => el && el.offsetParent !== null && !el.disabled);
                                    if (!inputs.length || !btnEl || !btnEl.getBoundingClientRect) return null;
                                    const br = btnEl.getBoundingClientRect();
                                    const cx = br.left + br.width / 2;
                                    const cy = br.top + br.height / 2;
                                    let best = null;
                                    let bestD = Infinity;
                                    for (const el of inputs) {
                                        const r = el.getBoundingClientRect();
                                        const x = r.left + r.width / 2;
                                        const y = r.top + r.height / 2;
                                        const d = Math.hypot(x - cx, y - cy);
                                        if (d < bestD) { bestD = d; best = el; }
                                    }
                                    return best;
                                };
                                const checkedCount = () => {
                                    return document.querySelectorAll(
                                      "table.contenttable-eroll tbody input[type='checkbox']:checked, " +
                                      ".datatable-box tbody input[type='checkbox']:checked, " +
                                      "table.datatable-box tbody input[type='checkbox']:checked"
                                    ).length;
                                };

                                document.addEventListener('click', (e) => {
                                    if (!isDownloadEl(e.target)) return;
                                    const btnEl = e.target.closest('button') || e.target.closest('input');
                                    if (window.__eciAllowAutomationClick) {
                                        // Let automation-triggered clicks through.
                                        window.__eciAllowAutomationClick = false;
                                        return;
                                    }
                                // If download captcha is required and empty, intercept only in OCR mode.
                                // In manual mode, user will type it and click again.
                                if (!window.__eciManualCaptchaMode) {
                                  const cap = nearestVisibleCaptchaInputTo(btnEl);
                                  const capVal = (cap && (cap.value || '').trim()) || '';
                                  if (cap && capVal.length < 4) {
                                          window.__eciLastDownloadGuardReason = 'captcha_missing';
                                          window.__eciUserRequestedDownload = true;
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                  }
                                }
                                    const n = checkedCount();
                                    if (n === 0) {
                                        window.__eciLastDownloadGuardReason = 'no_selection';
                                        window.__eciUserRequestedDownload = true;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                    }
                                    if (n > 10) {
                                        window.__eciLastDownloadGuardReason = 'too_many';
                                        window.__eciUserRequestedDownload = true;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                    }
                                    // Selection is valid; allow the click, but still mark it so automation can take over subsequent pages.
                                    window.__eciLastDownloadGuardReason = 'ok';
                                    window.__eciUserRequestedDownload = true;
                                }, true);
                            }"""
                        )
                    except Exception:
                        pass

                def _install_select_all_click_guard():
                    """
                    ECI shows "Maximum 10 Parts..." if the user truly selects all rows (>10).
                    We let the native Select All click run first (so the checkbox activates),
                    then after a short delay we trim selection to first 10 if needed.
                    """
                    try:
                        page.evaluate(
                            """() => {
                                if (window.__eciSelectAllGuardInstalled) return;
                                window.__eciSelectAllGuardInstalled = true;

                                const pickSelectAll = () => (
                                  document.querySelector("input#selectAll, input[id*='selectAll' i]") ||
                                  document.querySelector("table.contenttable-eroll thead input[type='checkbox'], .datatable-box thead input[type='checkbox'], table.datatable-box thead input[type='checkbox']") ||
                                  (() => {
                                    const tables = document.querySelectorAll("table");
                                    for (const t of tables) {
                                      const headCb = t.querySelector("thead input[type='checkbox']");
                                      if (headCb && t.querySelector("tbody input[type='checkbox']")) return headCb;
                                    }
                                    return null;
                                  })()
                                );
                                const rowBoxes = () => Array.from(document.querySelectorAll(
                                  "table.contenttable-eroll tbody input[type='checkbox'], " +
                                  ".datatable-box tbody input[type='checkbox'], " +
                                  "table.datatable-box tbody input[type='checkbox'], " +
                                  "table tbody input[type='checkbox']"
                                ));
                                const fire = (el) => {
                                  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                  try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                };
                                const delay = (ms) => new Promise(r => setTimeout(r, ms));
                                const setIndexTo = async (idx, desired) => {
                                  const rows = rowBoxes();
                                  const cb = rows[idx];
                                  if (!cb) return false;
                                  if (!!cb.checked !== desired) {
                                    try { cb.click(); } catch (e) { cb.checked = desired; }
                                    await delay(35);
                                  }
                                  if (!!cb.checked !== desired) { cb.checked = desired; fire(cb); }
                                  return !!cb.checked === desired;
                                };
                                const checkedCount = () => rowBoxes().filter(cb => cb && cb.checked).length;
                                const limit = 10;

                                function enforceMax10AfterSelectAll() {
                                  const selectAll = pickSelectAll();
                                  const rows = rowBoxes();
                                  const n = checkedCount();
                                  if (selectAll && !selectAll.checked) { window.__eciSelectAllMode = false; }
                                  if (n <= limit || !rows.length) {
                                    if (selectAll && n > 0) { window.__eciSelectAllMode = true; }
                                    return;
                                  }
                                  (async () => {
                                    for (let pass = 0; pass < 3; pass++) {
                                      const r = rowBoxes();
                                      for (let i = 0; i < r.length; i++) await setIndexTo(i, false);
                                      for (let i = 0; i < Math.min(limit, r.length); i++) await setIndexTo(i, true);
                                      if (checkedCount() >= Math.min(limit, r.length)) break;
                                      await delay(50);
                                    }
                                    if (selectAll) {
                                      selectAll.checked = true;
                                      try { selectAll.indeterminate = rowBoxes().length > limit; } catch (e) {}
                                    }
                                    window.__eciSelectAllMode = true;
                                  })().catch(() => {});
                                }

                                document.addEventListener('click', (e) => {
                                  const selectAll = pickSelectAll();
                                  if (!selectAll) return;
                                  const t = e.target;
                                  const isHeaderCb = (t === selectAll) || (selectAll.closest && selectAll.closest('th') && selectAll.closest('th').contains(t))
                                    || (selectAll.closest && selectAll.closest('tr') && selectAll.closest('tr').contains(t) && selectAll.closest('tr').querySelector('input[type=checkbox]') === selectAll)
                                    || (t.closest && t.closest("label[for='selectAll'], label[for*='selectAll' i]"));
                                  if (!isHeaderCb) return;
                                  // Let the click through so Select All toggles (checkbox activates).
                                  // Then fix selection to max 10 after the site's handler runs.
                                  setTimeout(enforceMax10AfterSelectAll, 50);
                                  setTimeout(enforceMax10AfterSelectAll, 200);
                                }, false);
                            }"""
                        )
                    except Exception:
                        pass

                page.on("download", _on_download)

                def _set_selection_js(start_idx: int, end_idx: int) -> bool:
                    """
                    Reliably enforce selection state in the parts table.
                    ECI warns if >10 parts are selected, so we always clear everything first
                    and then select only [start_idx, end_idx).
                    """
                    try:
                        res = page.evaluate(
                            """({ start, end }) => {
                                const selectAll =
                                  document.querySelector("input#selectAll, input[id*='selectAll' i]") ||
                                  document.querySelector("table.contenttable-eroll thead input[type='checkbox'], .datatable-box thead input[type='checkbox'], table.datatable-box thead input[type='checkbox']");
                                const rowBoxes = () => Array.from(document.querySelectorAll(
                                  "table.contenttable-eroll tbody input[type='checkbox'], " +
                                  ".datatable-box tbody input[type='checkbox'], " +
                                  "table.datatable-box tbody input[type='checkbox']"
                                ));
                                const fire = (el) => {
                                  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                  try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                };
                                const delay = (ms) => new Promise(r => setTimeout(r, ms));
                                const setIndexTo = async (idx, desired) => {
                                  const rows = rowBoxes();
                                  const cb = rows[idx];
                                  if (!cb) return false;
                                  const cur = !!cb.checked;
                                  if (cur !== desired) {
                                    try { cb.click(); } catch (e) { cb.checked = desired; }
                                    await delay(25);
                                  }
                                  if (!!cb.checked !== desired) cb.checked = desired;
                                  fire(cb);
                                  return !!cb.checked === desired;
                                };
                                if (selectAll) {
                                  // Do not fire events on select-all; ECI may select everything.
                                  selectAll.checked = false;
                                  try { selectAll.indeterminate = false; } catch (e) {}
                                }
                                const rows0 = rowBoxes();
                                const total = rows0.length;
                                const wantStart = Math.max(0, Math.min(start, total));
                                const wantEnd = Math.max(wantStart, Math.min(end, total));

                                // Clear all, then select desired slice. Retry to survive re-renders.
                                for (let pass = 0; pass < 3; pass++) {
                                  const rowsNow = rowBoxes();
                                  for (let i = 0; i < rowsNow.length; i++) await setIndexTo(i, false);
                                  for (let i = wantStart; i < wantEnd; i++) await setIndexTo(i, true);
                                  // Count by querying current DOM (not stale array).
                                  const checkedNow = rowBoxes().filter(cb => cb && cb.checked).length;
                                  if (checkedNow >= (wantEnd - wantStart)) break;
                                  await delay(50);
                                }
                                const checked = rowBoxes().filter(cb => cb && cb.checked).length;
                                // Keep "Select All" in sync: when any rows are selected, show Select All as checked
                                // (or indeterminate when only a subset is selected), so UI matches row state.
                                if (selectAll && checked > 0) {
                                  selectAll.checked = true;
                                  try { selectAll.indeterminate = (checked < total); } catch (e) {}
                                }
                                return { total, checked };
                            }""",
                            {"start": int(start_idx), "end": int(end_idx)},
                        )
                        if not res:
                            return False
                        expected = max(0, int(end_idx) - int(start_idx))
                        checked = int(res.get("checked") or 0)
                        return checked == expected and checked <= MAX_PARTS_PER_DOWNLOAD
                    except Exception:
                        return False

                def _refresh_download_captcha() -> bool:
                    """Click the captcha refresh icon near the download captcha (best-effort)."""
                    try:
                        return bool(
                            page.evaluate(
                                """() => {
                                    // Pick the captcha image nearest to the Download button (download captcha).
                                    const btn = Array.from(document.querySelectorAll('button, input')).find(el => {
                                      const t = (el.innerText || el.value || '').toLowerCase();
                                      return t.includes('download selected pdfs');
                                    });
                                    const imgs = Array.from(document.querySelectorAll('img[alt="captcha"], img[alt="Captcha"], img[src^="data:image"]'));
                                    const visible = imgs.filter(el => el && el.getBoundingClientRect && el.getBoundingClientRect().width > 0);
                                    if (!visible.length) return false;
                                    let capImg = visible[0];
                                    if (btn && btn.getBoundingClientRect) {
                                      const br = btn.getBoundingClientRect();
                                      const bx = br.left + br.width/2, by = br.top + br.height/2;
                                      let best = null, bestD = Infinity;
                                      for (const el of visible) {
                                        const r = el.getBoundingClientRect();
                                        const x = r.left + r.width/2, y = r.top + r.height/2;
                                        const d = Math.hypot(x-bx, y-by);
                                        if (d < bestD) { bestD = d; best = el; }
                                      }
                                      if (best) capImg = best;
                                    }
                                    if (!capImg) return false;
                                    const r0 = capImg.getBoundingClientRect();
                                    const cx = r0.left + r0.width / 2;
                                    const cy = r0.top + r0.height / 2;
                                    const candidates = Array.from(document.querySelectorAll(
                                      'img[alt*="refresh" i], img[src*="refresh" i], button[aria-label*="refresh" i], button[title*="refresh" i], a[aria-label*="refresh" i]'
                                    ));
                                    let best = null;
                                    let bestD = Infinity;
                                    for (const el of candidates) {
                                        if (!el || !el.getBoundingClientRect) continue;
                                        const r = el.getBoundingClientRect();
                                        if (r.width === 0 || r.height === 0) continue;
                                        const x = r.left + r.width / 2;
                                        const y = r.top + r.height / 2;
                                        const d = Math.hypot(x - cx, y - cy);
                                        if (d < bestD) { bestD = d; best = el; }
                                    }
                                    if (!best || bestD > 250) return false;
                                    best.click();
                                    return true;
                                }"""
                            )
                        )
                    except Exception:
                        return False

                def _fill_download_captcha_ocr_if_needed() -> bool:
                    """
                    If there's a visible captcha input near the Download button and it's empty,
                    OCR the captcha image and fill it.
                    """
                    try:
                        btn = download_btn
                        btn_box = btn.bounding_box() or {}
                        bx = btn_box.get("x", 0) + btn_box.get("width", 0) / 2
                        by = btn_box.get("y", 0) + btn_box.get("height", 0) / 2

                        # Prefer the captcha that belongs to the download area (same DOM container as the button).
                        # ECI pages can have multiple captchas; picking the wrong one makes OCR look "failed".
                        container = btn.locator(
                            "xpath=ancestor::*[self::form or self::div]"
                            "[.//input[contains(@name,'captcha') or contains(translate(@placeholder,'CAPTCHA','captcha'),'captcha') or contains(translate(@id,'CAPTCHA','captcha'),'captcha')]]"
                        ).first

                        scoped_inputs = None
                        scoped_imgs = None
                        if container.count() > 0:
                            scoped_inputs = container.locator(
                                "input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]"
                            )
                            scoped_imgs = container.locator(
                                "img[alt='captcha'], img[alt='Captcha'], img[src^='data:image']"
                            )

                        inputs = scoped_inputs if scoped_inputs is not None and scoped_inputs.count() > 0 else page.locator(
                            "input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]"
                        )
                        best = None
                        best_d = None
                        for i in range(min(inputs.count(), 8)):
                            el = inputs.nth(i)
                            try:
                                if not el.is_visible():
                                    continue
                                if el.is_disabled():
                                    continue
                                r = el.bounding_box()
                                if not r:
                                    continue
                                x = r["x"] + r["width"] / 2
                                y = r["y"] + r["height"] / 2
                                d = ((x - bx) ** 2 + (y - by) ** 2) ** 0.5
                                if best_d is None or d < best_d:
                                    best_d = d
                                    best = el
                            except Exception:
                                continue
                        if best is None:
                            # Debug: capture what the page looks like when captcha input is not found.
                            try:
                                dbg = _get_pdf_folder()
                                page.screenshot(path=str(dbg / "debug_download_captcha_no_input.png"))
                            except Exception:
                                pass
                            return False
                        try:
                            cur = (best.input_value(timeout=2000) or "").strip()
                        except Exception:
                            cur = ""
                        if len(cur) >= 4:
                            return True

                        for _ in range(3):
                            # OCR the captcha image nearest to this captcha input (download captcha),
                            # and prefer a direct screenshot for OCR (more reliable than reading `src`).
                            img_candidates = (
                                scoped_imgs
                                if scoped_imgs is not None and scoped_imgs.count() > 0
                                else page.locator('img[alt="captcha"], img[alt="Captcha"], img[src^="data:image"]')
                            )
                            best_img = None
                            best_img_d = None
                            try:
                                in_box = best.bounding_box() or {}
                                ix = in_box.get("x", 0) + in_box.get("width", 0) / 2
                                iy = in_box.get("y", 0) + in_box.get("height", 0) / 2
                            except Exception:
                                ix = iy = 0
                            for j in range(min(img_candidates.count(), 10)):
                                cand = img_candidates.nth(j)
                                try:
                                    if not cand.is_visible():
                                        continue
                                    b = cand.bounding_box()
                                    if not b:
                                        continue
                                    x = b["x"] + b["width"] / 2
                                    y = b["y"] + b["height"] / 2
                                    d = ((x - ix) ** 2 + (y - iy) ** 2) ** 0.5
                                    if best_img_d is None or d < best_img_d:
                                        best_img_d = d
                                        best_img = cand
                                except Exception:
                                    continue
                            if best_img is None:
                                _refresh_download_captcha()
                                page.wait_for_timeout(800)
                                continue

                            # IMPORTANT: The correct captcha textbox is typically immediately to the RIGHT
                            # of the captcha image (same row). Re-select the input based on the chosen image
                            # to avoid typing into unrelated fields (district, search, hidden inputs, etc.).
                            try:
                                ib = best_img.bounding_box() or {}
                                img_left = ib.get("x", 0)
                                img_top = ib.get("y", 0)
                                img_w = ib.get("width", 0)
                                img_h = ib.get("height", 0)
                                img_right = img_left + img_w
                                img_cy = img_top + img_h / 2 if img_h else img_top

                                right_best = None
                                right_best_dx = None
                                # Scan a few candidate inputs and pick the one to the right of the image.
                                for ii in range(min(inputs.count(), 12)):
                                    inp = inputs.nth(ii)
                                    try:
                                        if not inp.is_visible() or inp.is_disabled():
                                            continue
                                        rb = inp.bounding_box()
                                        if not rb:
                                            continue
                                        in_left = rb["x"]
                                        in_top = rb["y"]
                                        in_w = rb["width"]
                                        in_h = rb["height"]
                                        in_cy = in_top + in_h / 2 if in_h else in_top

                                        # Require input to be to the right of the captcha image.
                                        if in_left < (img_right - 2):
                                            continue
                                        # Require roughly same row (vertical alignment).
                                        if abs(in_cy - img_cy) > max(img_h, in_h, 1) * 1.2:
                                            continue

                                        dx = in_left - img_right
                                        if right_best_dx is None or dx < right_best_dx:
                                            right_best_dx = dx
                                            right_best = inp
                                    except Exception:
                                        continue

                                if right_best is not None:
                                    best = right_best
                            except Exception:
                                pass

                            data_uri = None
                            try:
                                png_bytes = best_img.screenshot(type="png")
                                if png_bytes:
                                    try:
                                        dbg = _get_pdf_folder()
                                        (dbg / "download_captcha.png").write_bytes(png_bytes)
                                    except Exception:
                                        pass
                                    data_uri = "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")
                            except Exception:
                                data_uri = None
                            if not data_uri:
                                try:
                                    src = best_img.get_attribute("src") or ""
                                except Exception:
                                    src = ""
                                if not src.strip().startswith("data:"):
                                    _refresh_download_captcha()
                                    page.wait_for_timeout(800)
                                    continue
                                data_uri = src

                            # Download-step captcha length can vary (often 5 or 6), so validate before submitting.
                            text = _ocr_captcha(data_uri, expected_len=None) or ""
                            text = _clean_captcha_text(text)
                            if len(text) not in (5, 6):
                                _refresh_download_captcha()
                                page.wait_for_timeout(800)
                                continue
                            try:
                                best.scroll_into_view_if_needed()
                            except Exception:
                                pass
                            # Some React-controlled inputs ignore Playwright fill() intermittently.
                            # Use multiple strategies: fill -> JS set value + events -> click+type.
                            try:
                                best.fill("")
                            except Exception:
                                pass
                            try:
                                best.fill(text)
                            except Exception:
                                pass
                            try:
                                best.evaluate(
                                    """(el, v) => {
                                        try { el.focus(); } catch (e) {}
                                        el.value = v;
                                        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                    }""",
                                    text,
                                )
                            except Exception:
                                pass
                            try:
                                now_val = (best.input_value(timeout=2000) or "").strip()
                            except Exception:
                                now_val = ""
                            if len(now_val) < 4:
                                try:
                                    best.click(timeout=2000)
                                except Exception:
                                    pass
                                try:
                                    best.fill("")
                                except Exception:
                                    pass
                                page.keyboard.type(text, delay=60)
                            try:
                                now_val = (best.input_value(timeout=2000) or "").strip()
                            except Exception:
                                now_val = ""
                            if len(now_val) >= 4:
                                return True
                            _refresh_download_captcha()
                            page.wait_for_timeout(800)
                        # Debug: OCR failed after retries; capture screenshot for inspection.
                        try:
                            dbg = _get_pdf_folder()
                            page.screenshot(path=str(dbg / "debug_download_captcha_ocr_failed.png"))
                        except Exception:
                            pass
                        return False
                    except Exception:
                        logger.exception("Download captcha OCR/fill failed unexpectedly")
                        try:
                            dbg = _get_pdf_folder()
                            page.screenshot(path=str(dbg / "debug_download_captcha_exception.png"))
                        except Exception:
                            pass
                        return False

                def _wait_for_download_outcome(timeout_ms: int = 45000, since_ts: float | None = None) -> tuple[str, object]:
                    """
                    Wait for one of:
                    - a Playwright download event (preferred)
                    - PDF bytes captured from network response / blob url (handled elsewhere)
                    - an 'Invalid Captcha' toast (fast retry)
                    Returns (status, payload):
                      status='download' -> payload is Download
                      status='blob' -> payload is current URL (string)
                      status='disk_pdf' -> payload is a Path (string) under backend/download/
                      status='invalid_captcha' -> payload is None
                      status='rate_limited' -> payload is a message string
                      status='timeout' -> payload is None
                    """
                    deadline = datetime.now().timestamp() + (timeout_ms / 1000.0)
                    invalid_toast = page.locator(
                        ':text("Invalid Captcha"), :text("invalid captcha"), :text("Invalid captcha")'
                    ).first
                    rate_toast = page.locator(
                        ':text("exceeded the request limit"), :text("request limit"), :text("Error Occured"), :text("Error Occurred")'
                    ).first
                    while datetime.now().timestamp() < deadline:
                        if downloads_collected:
                            return "download", downloads_collected[-1]
                        try:
                            u = (page.url or "").strip()
                            if u.startswith("blob:"):
                                return "blob", u
                        except Exception:
                            pass
                        if since_ts is not None:
                            try:
                                pth = _find_recent_top_level_pdf_in_download_dir(since_ts=float(since_ts))
                                if pth is not None:
                                    return "disk_pdf", str(pth)
                            except Exception:
                                pass
                        try:
                            if invalid_toast.count() > 0 and invalid_toast.is_visible():
                                return "invalid_captcha", None
                        except Exception:
                            pass
                        try:
                            if rate_toast.count() > 0 and rate_toast.is_visible():
                                try:
                                    msg = (rate_toast.inner_text() or "").strip()
                                except Exception:
                                    msg = "rate_limited"
                                return "rate_limited", msg
                        except Exception:
                            pass
                        page.wait_for_timeout(300)
                    return "timeout", None

                def _wait_for_manual_download_captcha(timeout_ms: int = 120000) -> bool:
                    """
                    In manual captcha mode, wait until the captcha input near the Download button
                    has a value (user typed it).
                    """
                    deadline = datetime.now().timestamp() + (timeout_ms / 1000.0)
                    while datetime.now().timestamp() < deadline:
                        try:
                            val = page.evaluate(
                                """() => {
                                    const btn = Array.from(document.querySelectorAll('button, input')).find(el => {
                                      const t = (el.innerText || el.value || '').toLowerCase();
                                      return t.includes('download selected pdfs');
                                    });
                                    if (!btn) return '';
                                    const cont = btn.closest('form') || btn.closest('div') || document;
                                    const inp =
                                      cont.querySelector("input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]") ||
                                      document.querySelector("input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]");
                                    return inp ? (inp.value || '') : '';
                                }"""
                            )
                            if val and str(val).strip() and len(str(val).strip()) >= 4:
                                return True
                        except Exception:
                            pass
                        page.wait_for_timeout(400)
                    return False

                def _dismiss_blocking_popups() -> None:
                    """Close visible warning/error toasts that can block clicks."""
                    try:
                        # Common close buttons (×) on toasts/modals.
                        for sel in (
                            'button:has-text("×")',
                            'button[aria-label="Close"]',
                            'button[aria-label="close"]',
                            '.toast button',
                            '.alert button',
                            '.modal button[aria-label="Close"]',
                        ):
                            btn = page.locator(sel).first
                            if btn.count() > 0:
                                try:
                                    if btn.is_visible():
                                        btn.click(timeout=1500)
                                except Exception:
                                    pass
                    except Exception:
                        pass

                def _wait_for_rate_limit_toast_gone(timeout_s: int = 15) -> None:
                    """After rate-limit backoff, wait for 'Error Occured' / request limit toast to disappear so clicks work."""
                    deadline = datetime.now().timestamp() + timeout_s
                    rate_toast = page.locator(
                        ':text("exceeded the request limit"), :text("request limit"), :text("Error Occured"), :text("Error Occurred")'
                    ).first
                    while datetime.now().timestamp() < deadline:
                        try:
                            if rate_toast.count() == 0 or not rate_toast.is_visible():
                                return
                        except Exception:
                            return
                        _dismiss_blocking_popups()
                        page.wait_for_timeout(500)
                    logger.info("Rate-limit toast still visible after %ds; continuing anyway.", timeout_s)

                def _parts_signature() -> str:
                    """Return a lightweight signature to detect page change."""
                    try:
                        return page.evaluate(
                            """() => {
                                const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
                                const table = document.querySelector('table.contenttable-eroll, table.datatable-box, .datatable-box table');
                                const rows = table ? Array.from(table.querySelectorAll('tbody tr')).slice(0, 3) : [];
                                const rowText = rows.map(r => norm((r.innerText || r.textContent || '').slice(0, 120))).join('||');

                                // Active page indicator is inconsistent across renders; try several patterns.
                                const pagerRoot =
                                  document.querySelector('.pagination-outer') ||
                                  document.querySelector('.pagination-inner') ||
                                  document.querySelector("nav[aria-label*='pagination' i]") ||
                                  document.querySelector('ul.pagination') ||
                                  document.querySelector('.pagination') ||
                                  document;
                                const active =
                                  pagerRoot.querySelector('.active') ||
                                  pagerRoot.querySelector('[aria-current="page"]') ||
                                  document.querySelector('.active') ||
                                  document.querySelector('[aria-current="page"]');
                                const activeText = active ? norm(active.innerText || active.textContent || '') : '';

                                // Also include "showing x to y" text if present (often changes per page).
                                const info =
                                  document.querySelector('.dataTables_info') ||
                                  document.querySelector('[class*="table-info" i]') ||
                                  document.querySelector('[class*="datatable" i] .info');
                                const infoText = info ? norm(info.innerText || info.textContent || '') : '';

                                return [activeText, infoText, rowText].join('|');
                            }"""
                        ) or ""
                    except Exception:
                        return ""

                def _ensure_parts_table_loaded_for_pagination() -> bool:
                    """
                    ECI sometimes forces captcha again when switching pages / after a download.
                    If that happens, we either wait for the user to solve it (manual_captcha)
                    or solve via OCR, then continue pagination.
                    """
                    try:
                        if page.locator("table.contenttable-eroll, table.datatable-box").count() > 0:
                            return True
                    except Exception:
                        pass

                    # Captcha present?
                    try:
                        has_cap = page.locator(captcha_input_sel).count() > 0 and page.locator(captcha_img_sel).count() > 0
                    except Exception:
                        has_cap = False
                    if not has_cap:
                        return False

                    logger.info("ECI asked captcha again; solving to continue pagination...")

                    cap_input = page.locator(captcha_input_sel).first
                    if manual_captcha:
                        # Manual captcha during pagination:
                        # User types captcha, then we auto-click Search/Show to reload the parts table.
                        try:
                            cap_input.scroll_into_view_if_needed()
                            cap_input.click()
                        except Exception:
                            pass
                        wait_until = datetime.now().timestamp() + 120
                        saw_value = False
                        while datetime.now().timestamp() < wait_until:
                            page.wait_for_timeout(1500)
                            try:
                                if page.locator("table.contenttable-eroll, table.datatable-box").count() > 0:
                                    return True
                            except Exception:
                                pass
                            # If user typed captcha, submit automatically (reduces manual steps).
                            if not saw_value:
                                try:
                                    val = (cap_input.input_value(timeout=1500) or "").strip()
                                except Exception:
                                    val = ""
                                if len(val) >= 4:
                                    saw_value = True
                                    submit_btn = page.locator(submit_search_show).first
                                    if submit_btn.count() == 0:
                                        submit_btn = page.locator(submit_any_not_login).first
                                    if submit_btn.count() > 0:
                                        try:
                                            _cursor_click(submit_btn, timeout=10000)
                                        except Exception:
                                            try:
                                                submit_btn.click(timeout=10000, force=True)
                                            except Exception:
                                                pass
                                    # After clicking, loop will detect the table.
                        return False

                    # OCR path: read captcha, fill, click Search/Show.
                    captcha_img = page.locator('img[alt="captcha"], img[alt="Captcha"]').first
                    if captcha_img.count() == 0:
                        captcha_img = page.locator(captcha_img_sel).last
                    src = None
                    try:
                        src = captcha_img.get_attribute("src")
                    except Exception:
                        src = None
                    if not src or not str(src).strip().startswith("data:"):
                        return False
                    captcha_text = _ocr_captcha(src, expected_len=6)
                    if not captcha_text:
                        return False
                    try:
                        cap_input.scroll_into_view_if_needed()
                        cap_input.click()
                        page.wait_for_timeout(100)
                        cap_input.fill("")
                        page.keyboard.type(captcha_text, delay=80)
                    except Exception:
                        try:
                            cap_input.fill(captcha_text)
                        except Exception:
                            return False

                    submit_btn = page.locator(submit_search_show).first
                    if submit_btn.count() == 0:
                        submit_btn = page.locator(submit_any_not_login).first
                    if submit_btn.count() == 0:
                        return False
                    try:
                        submit_btn.click()
                    except Exception:
                        return False

                    try:
                        page.wait_for_timeout(3500)
                    except Exception:
                        pass
                    return page.locator("table.contenttable-eroll, table.datatable-box").count() > 0

                max_pages = 200
                total_parts_downloaded = 0
                # Manual workflow requirement:
                # - Enter captcha (no auto selection)
                # - User clicks Select All / selects rows
                # - User clicks Download Selected PDFs
                #
                # So we start with auto-select OFF and "download started" OFF. These become True only
                # after the user explicitly clicks Select All / Download.
                auto_select_all_pages = False
                # Require a user-initiated click on "Download Selected PDFs" before starting downloads.
                user_started_download = False
                for page_num in range(max_pages):
                    # Ensure guard is present (it survives pagination, but re-install is cheap).
                    _install_download_click_guard()
                    _install_select_all_click_guard()
                    try:
                        page.evaluate("(v) => { window.__eciManualCaptchaMode = v; }", bool(manual_captcha))
                    except Exception:
                        pass
                    # Manual requirement: never carry selection intent across pages.
                    # If __eciSelectAllMode stays true from page 1, later pages may auto-select rows.
                    if manual_captcha:
                        try:
                            page.evaluate("() => { window.__eciSelectAllMode = false; }")
                        except Exception:
                            pass
                        # In manual captcha mode user must click "Select All" on each page; do not persist.
                        auto_select_all_pages = False
                    # If we are NOT persisting across pages, require user click per page.
                    if not AUTO_SELECT_PARTS and not PERSIST_SELECT_ALL_ACROSS_PAGES:
                        user_started_download = False
                    if auto_select_all_pages:
                        try:
                            page.evaluate("() => { window.__eciSelectAllMode = true; }")
                        except Exception:
                            pass
                    if not _ensure_parts_table_loaded_for_pagination():
                        error_msg = (
                            "Parts table not visible. ECI may be asking captcha again or session expired. "
                            "Please solve captcha in the browser (or enable OCR) and try again."
                        )
                        break
                    parts_table = page.locator("table.contenttable-eroll, table.datatable-box").first
                    if parts_table.count() > 0:
                        parts_table.scroll_into_view_if_needed()
                        page.wait_for_timeout(600)
                    # Clear any previous selection so "Select All" applies only to the current page
                    # (prevents ECI thinking >10 are selected due to carry-over).
                    try:
                        page.evaluate(
                            """() => {
                                const rows = Array.from(document.querySelectorAll(
                                  "table.contenttable-eroll tbody input[type='checkbox'], " +
                                  ".datatable-box tbody input[type='checkbox'], " +
                                  "table.datatable-box tbody input[type='checkbox']"
                                ));
                                for (const cb of rows) {
                                  cb.checked = false;
                                  try { cb.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
                                  try { cb.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                                }
                            }"""
                        )
                    except Exception:
                        pass
                    row_checkboxes = page.locator(
                        "table.contenttable-eroll tbody tr input[type='checkbox'], "
                        ".datatable-box tbody tr input[type='checkbox'], "
                        "table.datatable-box tbody tr input[type='checkbox']"
                    )
                    select_all = page.locator(
                        "table.contenttable-eroll thead input[type='checkbox'], "
                        ".datatable-box thead input[type='checkbox'], "
                        "table.datatable-box thead input[type='checkbox'], "
                        # ECI sometimes uses id/label for select-all (label[for="selectAll"]).
                        "input#selectAll, input[id*='selectAll' i]"
                    ).first
                    n = row_checkboxes.count()
                    if n == 0:
                        if page_num == 0:
                            error_msg = "No parts table rows found"
                            break
                        # Page 2+: table may still be loading after Next click; wait for rows before giving up.
                        for _ in range(30):
                            page.wait_for_timeout(500)
                            _dismiss_blocking_popups()
                            row_checkboxes = page.locator(
                                "table.contenttable-eroll tbody tr input[type='checkbox'], "
                                ".datatable-box tbody tr input[type='checkbox'], "
                                "table.datatable-box tbody tr input[type='checkbox']"
                            )
                            n = row_checkboxes.count()
                            if n > 0:
                                break
                        if n == 0:
                            logger.info("No parts rows on page %d (last page or table not loaded) — stopping pagination", page_num + 1)
                            break

                    def _checked_rows_count() -> int:
                        try:
                            return int(
                                page.evaluate(
                                    """() => {
                                        return document.querySelectorAll(
                                          "table.contenttable-eroll tbody input[type='checkbox']:checked, " +
                                          ".datatable-box tbody input[type='checkbox']:checked, " +
                                          "table.datatable-box tbody input[type='checkbox']:checked"
                                        ).length;
                                    }"""
                                )
                                or 0
                            )
                        except Exception:
                            return 0
                    # Track the most recent moment a download was triggered on this page.
                    # Used to wait for completion before moving to the next pagination page.
                    last_download_ts: float | None = None
                    # ECI allows max 10 parts per click.
                    # If AUTO_SELECT_PARTS=False, never auto toggle checkboxes; use only manually selected rows.
                    def _row_toggle(idx: int, should_check: bool) -> bool:
                        """Toggle row checkbox with retry; handles transient DOM re-renders."""
                        for _ in range(3):
                            chk = row_checkboxes.nth(idx)
                            if chk.count() == 0:
                                page.wait_for_timeout(100)
                                continue
                            try:
                                try:
                                    chk.wait_for(state="visible", timeout=1500)
                                except Exception:
                                    pass
                                if should_check:
                                    chk.scroll_into_view_if_needed()
                                    page.wait_for_timeout(50)
                                    _safe_check(chk)
                                else:
                                    _safe_uncheck(chk)
                                return True
                            except Exception as e:
                                msg = str(e).lower()
                                if "not attached to the dom" in msg or "detached" in msg or "element is not attached" in msg:
                                    page.wait_for_timeout(120)
                                    continue
                                if "timeout" in msg:
                                    page.wait_for_timeout(120)
                                    continue
                                raise
                        return False

                    # Decide mode for this page:
                    # - AUTO_SELECT_PARTS=True: always download all parts (batched)
                    # - If user checks "Select All" once, optionally persist across pages
                    # - If user clicks Select All on THIS page (manual workflow), batch 10-at-a-time for THIS page
                    force_auto_mode_this_page = False
                    # If select-all mode was enabled previously (e.g. user clicked Select All on page 1),
                    # keep auto batching enabled on subsequent pages to avoid "Please select Part".
                    select_all_mode_js = False
                    if not manual_captcha:
                        try:
                            select_all_mode_js = bool(page.evaluate("() => !!window.__eciSelectAllMode"))
                        except Exception:
                            select_all_mode_js = False
                        if select_all_mode_js:
                            auto_select_all_pages = True
                    auto_mode = AUTO_SELECT_PARTS or (auto_select_all_pages and PERSIST_SELECT_ALL_ACROSS_PAGES) or select_all_mode_js
                    manual_checked_rows = 0
                    # If the user already successfully started downloads on page 1, continue automatically
                    # on page 2+ when persistence is enabled. Otherwise we would keep waiting for manual
                    # checkbox selection on every page.
                    # In manual_captcha mode we never auto-select: user must click "Select All" on each page.
                    if (
                        not manual_captcha
                        and not auto_mode
                        and user_started_download
                        and PERSIST_SELECT_ALL_ACROSS_PAGES
                    ):
                        auto_mode = True
                        auto_select_all_pages = True
                        try:
                            page.evaluate("() => { window.__eciSelectAllMode = true; }")
                        except Exception:
                            pass
                        logger.info(
                            "Continuing auto-download on next pages (page %d): batching in %d-part chunks.",
                            page_num + 1,
                            MAX_PARTS_PER_DOWNLOAD,
                        )
                        # Ensure a safe first batch selection exists immediately (avoids ECI warnings).
                        try:
                            _set_selection_js(0, min(MAX_PARTS_PER_DOWNLOAD, n))
                        except Exception:
                            pass
                    # Manual captcha flow: on every page, first wait for user to enter captcha, then auto-select all and auto-download.
                    if manual_captcha and not auto_mode:
                        logger.info(
                            "Page %d: enter captcha in the box next to 'Download Selected PDFs'; after you enter it we will auto-select all and download.",
                            page_num + 1,
                        )
                        if not _wait_for_manual_download_captcha(timeout_ms=120000):
                            error_msg = "Captcha not entered in time. Enter the captcha for this page and try again."
                            break
                        auto_mode = True
                        user_started_download = True
                        try:
                            _set_selection_js(0, min(MAX_PARTS_PER_DOWNLOAD, n))
                        except Exception:
                            pass
                        logger.info("Captcha entered. Auto-selecting all (batched) and downloading...")
                    if not auto_mode:
                        # Wait for the user to select something (row checkbox or "select all").
                        wait_deadline = datetime.now().timestamp() + 90
                        warned = False
                        while datetime.now().timestamp() < wait_deadline:
                            try:
                                if select_all.count() > 0 and select_all.is_checked():
                                    if PERSIST_SELECT_ALL_ACROSS_PAGES:
                                        auto_select_all_pages = True
                                        auto_mode = True
                                        # User intent: "Select All" means "select everything", but
                                        # downloads should start only after the user clicks
                                        # "Download Selected PDFs" (manual workflow).
                                        try:
                                            page.evaluate("() => { window.__eciSelectAllMode = true; }")
                                        except Exception:
                                            pass
                                        logger.info(
                                            "Select All detected. ECI allows max %d parts per download; "
                                            "will batch downloads after you click 'Download Selected PDFs'...",
                                            MAX_PARTS_PER_DOWNLOAD,
                                        )
                                        # Immediately normalize selection to a safe first batch to avoid ECI warnings.
                                        try:
                                            _set_selection_js(0, min(MAX_PARTS_PER_DOWNLOAD, n))
                                        except Exception:
                                            pass
                                    else:
                                        # Manual workflow: user clicked Select All on this page.
                                        # ECI still enforces 10 parts per download, so batch automatically on THIS page.
                                        force_auto_mode_this_page = True
                                    break
                            except Exception:
                                pass

                            # If user already clicked Download but guard intercepted due to >10 selected,
                            # treat it as "Select All" intent for this page and batch automatically.
                            try:
                                requested = page.evaluate("() => !!window.__eciUserRequestedDownload")
                                reason = (page.evaluate("() => window.__eciLastDownloadGuardReason") or "").lower()
                                if requested and reason == "too_many":
                                    force_auto_mode_this_page = True
                                    break
                            except Exception:
                                pass

                            manual_checked_rows = page.locator(
                                "table.contenttable-eroll tbody tr input[type='checkbox']:checked, "
                                ".datatable-box tbody tr input[type='checkbox']:checked, "
                                "table.datatable-box tbody tr input[type='checkbox']:checked"
                            ).count()
                            if manual_checked_rows > 0:
                                break
                            if not warned:
                                logger.info(
                                    "Select the part checkboxes (or 'Select All'), then click 'Download Selected PDFs' to start...",
                                )
                                warned = True
                            page.wait_for_timeout(1000)

                        # Apply per-page forced batching if Select All was clicked (non-persisting mode).
                        if force_auto_mode_this_page:
                            auto_mode = True
                            # "Select All" on this page enables batching, but downloads still start only
                            # after the user clicks "Download Selected PDFs".
                            logger.info(
                                "Select All on this page detected — will download this page in %d-part batches after you click 'Download Selected PDFs'.",
                                MAX_PARTS_PER_DOWNLOAD,
                            )
                            try:
                                _set_selection_js(0, min(MAX_PARTS_PER_DOWNLOAD, n))
                            except Exception:
                                pass

                        if not auto_mode:
                            if manual_checked_rows == 0:
                                error_msg = "No rows selected. Select at least 1 row (or Select All) to download."
                                break
                            if manual_checked_rows > MAX_PARTS_PER_DOWNLOAD:
                                error_msg = (
                                    f"{manual_checked_rows} rows are selected. ECI allows max {MAX_PARTS_PER_DOWNLOAD} parts per download. "
                                    "Use 'Select All' to let automation batch the downloads, or keep only up to 10 selected."
                                )
                                break

                    # If we're in auto mode, download all parts on this page in batches of 10.
                    # Otherwise, download only the manually selected rows on this page (single batch).
                    batch_starts = range(0, n, MAX_PARTS_PER_DOWNLOAD) if auto_mode else range(0, 1)
                    for batch_start in batch_starts:
                        if auto_mode:
                            batch_end = min(batch_start + MAX_PARTS_PER_DOWNLOAD, n)
                            batch_size = batch_end - batch_start
                            # Avoid the ECI warning ("Maximum 10 parts...") by enforcing selection via JS.
                            # This prevents transient states where more than 10 appear selected during re-renders.
                            if not _set_selection_js(batch_start, batch_end):
                                # Fallback to UI toggling if JS fails.
                                if select_all.count() > 0:
                                    try:
                                        select_all.scroll_into_view_if_needed()
                                        page.wait_for_timeout(100)
                                        _safe_uncheck(select_all)
                                        page.wait_for_timeout(100)
                                    except Exception as e:
                                        msg = str(e).lower()
                                        if "not attached to the dom" in msg or "detached" in msg or "element is not attached" in msg:
                                            page.wait_for_timeout(150)
                                        else:
                                            raise
                                for i in range(n):
                                    _row_toggle(i, should_check=False)
                                page.wait_for_timeout(200)
                                for i in range(batch_start, batch_end):
                                    _row_toggle(i, should_check=True)
                            # Safety: if ECI still thinks 0 rows are selected (common after pagination re-render),
                            # enforce selection again to avoid "Please select Part".
                            if _checked_rows_count() == 0:
                                try:
                                    _set_selection_js(batch_start, batch_end)
                                except Exception:
                                    pass
                            logger.info(
                                "Page %d batch: %d part(s) (rows %d–%d of %d)",
                                page_num + 1,
                                batch_size,
                                batch_start,
                                batch_end - 1,
                                n,
                            )
                        else:
                            batch_size = manual_checked_rows
                            logger.info(
                                "Page %d manual selection: %d part(s) selected; waiting for you to click Download...",
                                page_num + 1,
                                manual_checked_rows,
                            )

                        page.wait_for_timeout(500)
                        downloads_collected.clear()
                        got_pdf_from_response = False
                        captured_pdf_response["body"] = None

                        for download_attempt in range(4):
                            # Save every downloaded PDF into the final output folder structure, not backend/pdf.
                            # Include the run timestamp (pdf_path.stem) to avoid overwriting across runs.
                            batch_file = output_folder / f"{pdf_path.stem}_p{page_num + 1}_r{batch_start}.pdf"
                            try:
                                # Attach response capture so we can save even if ECI opens inline/blob.
                                try:
                                    page.on("response", _on_response_capture_pdf)
                                except Exception:
                                    pass
                                try:
                                    should_click_download = AUTO_SELECT_PARTS or user_started_download
                                    d = None
                                    if should_click_download:
                                        # On every page: try to fill download captcha via OCR first (after Select All).
                                        if not _fill_download_captcha_ocr_if_needed():
                                            if manual_captcha:
                                                logger.info("OCR did not fill captcha; waiting for you to enter captcha for Download...")
                                                if not _wait_for_manual_download_captcha(timeout_ms=120000):
                                                    raise TimeoutError("Manual captcha not entered in time for Download")
                                            else:
                                                raise RuntimeError("Could not OCR the download captcha. Try again or switch to manual captcha.")
                                        try:
                                            page.evaluate("() => { window.__eciAllowAutomationClick = true; }")
                                        except Exception:
                                            pass
                                        click_ts = time.time()
                                        last_download_ts = click_ts
                                        _cursor_click(download_btn)
                                        # If Chrome saved a UUID-named PDF (no extension), rename it ASAP.
                                        for _ in range(8):  # ~4s
                                            if _rename_extensionless_pdfs_in_download_dir(since_ts=click_ts) > 0:
                                                break
                                            page.wait_for_timeout(500)
                                        status, payload = _wait_for_download_outcome(timeout_ms=DOWNLOAD_WAIT_MS, since_ts=click_ts)
                                        if status == "invalid_captcha":
                                            raise RuntimeError("invalid_captcha")
                                        if status == "rate_limited":
                                            # Back off aggressively; continuing to click will only worsen the rate limit.
                                            logger.warning("ECI rate limit hit: %s. Backing off %ds...", payload, ECI_RATE_LIMIT_BACKOFF_S)
                                            _dismiss_blocking_popups()
                                            page.wait_for_timeout(int(ECI_RATE_LIMIT_BACKOFF_S * 1000))
                                            _dismiss_blocking_popups()
                                            _wait_for_rate_limit_toast_gone(timeout_s=15)
                                            raise TimeoutError("rate_limited")
                                        if status == "disk_pdf":
                                            # Chrome wrote a PDF file directly to backend/download/ (UUID name, maybe no extension).
                                            # Move it into our structured batch_file path.
                                            if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=click_ts):
                                                all_batch_paths.append(batch_file)
                                                total_parts_downloaded += batch_size
                                                got_pdf_from_response = True
                                                user_started_download = True
                                                break
                                            raise TimeoutError("Disk PDF detected but could not be harvested")
                                        if status == "blob":
                                            # Inline PDF opened as blob: URL (no download event). Save bytes from blob.
                                            if _try_save_pdf_from_blob_url(batch_file):
                                                all_batch_paths.append(batch_file)
                                                total_parts_downloaded += batch_size
                                                got_pdf_from_response = True
                                                user_started_download = True
                                                try:
                                                    page.go_back(wait_until="domcontentloaded", timeout=20000)
                                                    page.wait_for_timeout(1000)
                                                except Exception:
                                                    pass
                                                break
                                            raise TimeoutError("Blob PDF opened but could not be saved")
                                        if status == "download":
                                            d = payload
                                        else:
                                            # timeout: do a final disk-based recovery before failing.
                                            try:
                                                _wait_for_download_dir_idle(since_ts=click_ts, timeout_s=180)
                                            except Exception:
                                                pass
                                            try:
                                                _rename_extensionless_pdfs_in_download_dir(since_ts=click_ts)
                                            except Exception:
                                                pass
                                            try:
                                                if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=click_ts):
                                                    all_batch_paths.append(batch_file)
                                                    total_parts_downloaded += batch_size
                                                    got_pdf_from_response = True
                                                    user_started_download = True
                                                    d = None
                                                    break
                                            except Exception:
                                                pass
                                            try:
                                                if downloads_collected:
                                                    d = downloads_collected[-1]
                                            except Exception:
                                                pass
                                            if d is None and not (got_pdf_from_response and batch_file.exists()):
                                                try:
                                                    page.screenshot(path=str(pdf_folder / "debug_download_post_click_timeout.png"))
                                                except Exception:
                                                    pass
                                                raise TimeoutError("No download event (post-click)")
                                    else:
                                        # Wait for the user to click "Download Selected PDFs" (first batch).
                                        logger.info("Waiting for you to click 'Download Selected PDFs' in the browser...")
                                        deadline = datetime.now().timestamp() + (DOWNLOAD_WAIT_MS / 1000.0)
                                        watch_ts = time.time()
                                        # Important: last_download_ts should be set when download actually starts,
                                        # not when we started waiting.
                                        while datetime.now().timestamp() < deadline:
                                            # If our guard intercepted the user's click (because >10 or 0 selected),
                                            # we should take over and perform the correct batched click.
                                            try:
                                                requested = page.evaluate("() => !!window.__eciUserRequestedDownload")
                                                reason = page.evaluate("() => window.__eciLastDownloadGuardReason") or ""
                                            except Exception:
                                                requested, reason = False, ""
                                            if requested:
                                                try:
                                                    page.evaluate("() => { window.__eciUserRequestedDownload = false; }")
                                                except Exception:
                                                    pass
                                                reason_l = (reason or "").lower().strip()
                                                if reason_l == "captcha_missing":
                                                    # Try OCR first on every page (after Select All); fall back to manual if needed.
                                                    if not _fill_download_captcha_ocr_if_needed():
                                                        if manual_captcha:
                                                            logger.info("OCR did not fill captcha; enter captcha in the browser, then click Download again.")
                                                            if not _wait_for_manual_download_captcha(timeout_ms=120000):
                                                                raise TimeoutError("Manual captcha not entered in time for Download")
                                                        else:
                                                            raise RuntimeError(
                                                                "Could not OCR the download captcha. Try again or switch to manual captcha."
                                                            )

                                                if reason_l == "too_many" and not auto_mode:
                                                    raise RuntimeError(
                                                        f"ECI allows max {MAX_PARTS_PER_DOWNLOAD} parts per download. "
                                                        "Either select up to 10 rows, or click Select All to enable auto-batching."
                                                    )

                                                if reason_l == "no_selection":
                                                    # User clicked Download with 0 selected. In manual_captcha we never auto-select;
                                                    # user must select rows or click Select All. Otherwise auto-select first batch
                                                    # only when select-all mode/persistence is active.
                                                    if manual_captcha:
                                                        raise RuntimeError("No parts selected. Select at least 1 row or Select All.")
                                                    if auto_mode or auto_select_all_pages or select_all_mode_js or PERSIST_SELECT_ALL_ACROSS_PAGES:
                                                        try:
                                                            _set_selection_js(
                                                                batch_start,
                                                                min(batch_start + MAX_PARTS_PER_DOWNLOAD, n),
                                                            )
                                                        except Exception:
                                                            pass
                                                    else:
                                                        raise RuntimeError("No parts selected. Select at least 1 row or Select All.")

                                                # Auto mode: enforce a safe selection for this batch, then trigger the real click
                                                # via automation (bypassing guard). Try OCR for captcha first on every page.
                                                if not _fill_download_captcha_ocr_if_needed():
                                                    if manual_captcha:
                                                        logger.info("OCR did not fill captcha; enter captcha, then click Download again.")
                                                        if not _wait_for_manual_download_captcha(timeout_ms=120000):
                                                            raise TimeoutError("Manual captcha not entered in time for Download")
                                                    else:
                                                        raise RuntimeError(
                                                            "Could not OCR the download captcha. Try again or switch to manual captcha."
                                                        )
                                                try:
                                                    page.evaluate("() => { window.__eciAllowAutomationClick = true; }")
                                                except Exception:
                                                    pass
                                                click_ts2 = time.time()
                                                last_download_ts = click_ts2
                                                _cursor_click(download_btn)
                                                status, payload = _wait_for_download_outcome(
                                                    timeout_ms=DOWNLOAD_WAIT_MS,
                                                    since_ts=click_ts2,
                                                )
                                                if status == "invalid_captcha":
                                                    raise RuntimeError("invalid_captcha")
                                                if status == "rate_limited":
                                                    logger.warning(
                                                        "ECI rate limit hit: %s. Backing off %ds...",
                                                        payload,
                                                        ECI_RATE_LIMIT_BACKOFF_S,
                                                    )
                                                    _dismiss_blocking_popups()
                                                    page.wait_for_timeout(int(ECI_RATE_LIMIT_BACKOFF_S * 1000))
                                                    _dismiss_blocking_popups()
                                                    _wait_for_rate_limit_toast_gone(timeout_s=15)
                                                    raise TimeoutError("rate_limited")
                                                if status == "disk_pdf":
                                                    if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=click_ts2):
                                                        all_batch_paths.append(batch_file)
                                                        total_parts_downloaded += batch_size
                                                        got_pdf_from_response = True
                                                        user_started_download = True
                                                        d = None
                                                        break
                                                    raise TimeoutError("Disk PDF detected but could not be harvested")
                                                if status == "download":
                                                    d = payload
                                                    break

                                                # timeout: do a final disk-based recovery before failing.
                                                try:
                                                    _wait_for_download_dir_idle(since_ts=click_ts2, timeout_s=180)
                                                except Exception:
                                                    pass
                                                try:
                                                    _rename_extensionless_pdfs_in_download_dir(since_ts=click_ts2)
                                                except Exception:
                                                    pass
                                                try:
                                                    if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=click_ts2):
                                                        all_batch_paths.append(batch_file)
                                                        total_parts_downloaded += batch_size
                                                        got_pdf_from_response = True
                                                        user_started_download = True
                                                        d = None
                                                        break
                                                except Exception:
                                                    pass
                                                try:
                                                    page.screenshot(
                                                        path=str(pdf_folder / "debug_download_post_click_timeout.png")
                                                    )
                                                except Exception:
                                                    pass
                                                raise TimeoutError("No download event (post-click)")
                                            if downloads_collected:
                                                last_download_ts = time.time()
                                                d = downloads_collected[-1]
                                                break
                                            if captured_pdf_response.get("body"):
                                                last_download_ts = time.time()
                                                break
                                            # User-triggered Chrome download may appear as an extensionless UUID file.
                                            _rename_extensionless_pdfs_in_download_dir(since_ts=watch_ts)
                                            # If Chrome wrote the PDF directly to disk (UUID filename), harvest it.
                                            if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=watch_ts):
                                                last_download_ts = time.time()
                                                all_batch_paths.append(batch_file)
                                                total_parts_downloaded += batch_size
                                                got_pdf_from_response = True
                                                user_started_download = True
                                                d = None
                                                break
                                            try:
                                                if (page.url or "").startswith("blob:"):
                                                    # User click opened inline PDF; save immediately instead of timing out.
                                                    if _try_save_pdf_from_blob_url(batch_file):
                                                        last_download_ts = time.time()
                                                        all_batch_paths.append(batch_file)
                                                        total_parts_downloaded += batch_size
                                                        got_pdf_from_response = True
                                                        user_started_download = True
                                                        try:
                                                            page.go_back(wait_until="domcontentloaded", timeout=20000)
                                                            page.wait_for_timeout(1000)
                                                        except Exception:
                                                            pass
                                                        d = None
                                                        break
                                                    break
                                            except Exception:
                                                pass
                                            page.wait_for_timeout(500)
                                        if d is None and not captured_pdf_response.get("body") and not (
                                            got_pdf_from_response and batch_file.exists()
                                        ):
                                            # Trigger fallback handling / timeout message.
                                            raise TimeoutError("No download started (waiting for user click)")
                                finally:
                                    try:
                                        page.off("response", _on_response_capture_pdf)
                                    except Exception:
                                        pass

                                try:
                                    if d is None:
                                        # If we already saved via blob/response path, treat as success.
                                        if got_pdf_from_response and batch_file.exists():
                                            break
                                        raise RuntimeError("No download event")
                                    d.save_as(str(batch_file))
                                except Exception:
                                    page.wait_for_timeout(1000)
                                    if d is None:
                                        raise
                                    d.save_as(str(batch_file))

                                # Validate PDF header so we don't merge HTML/error pages.
                                # On Windows/Chrome this file can briefly be empty right after save_as,
                                # so wait a bit for bytes to land before declaring it non-PDF.
                                head = b""
                                try:
                                    # Best-effort: wait for file to become non-empty/stable.
                                    since_ts_for_idle = last_download_ts or time.time()
                                    for _ in range(30):  # ~6s max
                                        try:
                                            if batch_file.exists():
                                                st = batch_file.stat()
                                                if st.st_size > 10_000:
                                                    break
                                        except Exception:
                                            pass
                                        page.wait_for_timeout(200)
                                    try:
                                        # If downloads are still flushing, wait for the directory to become idle.
                                        _wait_for_download_dir_idle(since_ts=float(since_ts_for_idle), timeout_s=30)
                                    except Exception:
                                        pass
                                    head = batch_file.read_bytes()[:5]
                                except Exception:
                                    head = b""

                                if head != b"%PDF-":
                                    # Fallback 1: captured network response body (PDF bytes).
                                    try:
                                        body = captured_pdf_response.get("body")
                                        if body and len(body) > 100 and body[:5] == b"%PDF-":
                                            batch_file.write_bytes(body)
                                            head = b"%PDF-"
                                    except Exception:
                                        pass

                                if head != b"%PDF-":
                                    # Fallback 2: Chrome wrote a UUID file directly to backend/download/; harvest it.
                                    try:
                                        since_ts_for_idle = last_download_ts or time.time()
                                        if _harvest_recent_pdf_from_download_dir(batch_file, since_ts=float(since_ts_for_idle)):
                                            head = b"%PDF-"
                                    except Exception:
                                        pass

                                if head != b"%PDF-":
                                    # Fallback 3: page navigated to blob: URL instead of download event.
                                    try:
                                        if _try_save_pdf_from_blob_url(batch_file):
                                            head = b"%PDF-"
                                    except Exception:
                                        pass

                                if head != b"%PDF-":
                                    debug_bad = pdf_folder / f"debug_non_pdf_p{page_num + 1}_r{batch_start}.bin"
                                    try:
                                        debug_bad.write_bytes(batch_file.read_bytes())
                                    except Exception:
                                        pass
                                    raise RuntimeError(
                                        "Downloaded file is not a PDF (got %r). See %s" % (head, debug_bad)
                                    )

                                all_batch_paths.append(batch_file)
                                total_parts_downloaded += batch_size
                                got_pdf_from_response = True
                                user_started_download = True
                                break
                            except Exception as dl_e:
                                msg = str(dl_e).lower()
                                if "rate_limited" in msg or "request limit" in msg or "exceeded the request limit" in msg:
                                    # Rate limit: wait and retry this same batch.
                                    try:
                                        page.screenshot(path=str(pdf_folder / "debug_rate_limited.png"))
                                    except Exception:
                                        pass
                                    logger.warning("Rate limited by ECI. Waiting %ds then retrying...", ECI_RATE_LIMIT_BACKOFF_S)
                                    _dismiss_blocking_popups()
                                    page.wait_for_timeout(int(ECI_RATE_LIMIT_BACKOFF_S * 1000))
                                    _dismiss_blocking_popups()
                                    _wait_for_rate_limit_toast_gone(timeout_s=15)
                                    continue
                                if "invalid_captcha" in msg or "invalid captcha" in msg:
                                    logger.info("ECI reported Invalid Captcha — refreshing and retrying...")
                                    try:
                                        _refresh_download_captcha()
                                    except Exception:
                                        pass
                                    try:
                                        # Clear any partially entered value in captcha input.
                                        page.evaluate(
                                            """() => {
                                                const inputs = Array.from(document.querySelectorAll(
                                                  "input[name='captcha'], input[id*='captcha' i], input[placeholder*='captcha' i]"
                                                )).filter(el => el && el.offsetParent !== null && !el.disabled);
                                                for (const el of inputs) { el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); }
                                            }"""
                                        )
                                    except Exception:
                                        pass
                                    page.wait_for_timeout(800)
                                    continue
                                if not got_pdf_from_response and ("timeout" in msg or "timed out" in msg or "no download" in msg):
                                    # 1) Save from captured PDF response body.
                                    try:
                                        body = captured_pdf_response.get("body")
                                        if body and len(body) > 100 and body[:5] == b"%PDF-":
                                            batch_file.write_bytes(body)
                                            all_batch_paths.append(batch_file)
                                            total_parts_downloaded += batch_size
                                            got_pdf_from_response = True
                                            logger.info("Saved PDF from network response to %s", batch_file)
                                            user_started_download = True
                                            break
                                    except Exception:
                                        pass
                                    # 2) Save from inline blob: URL if ECI navigated to it.
                                    try:
                                        if _try_save_pdf_from_blob_url(batch_file):
                                            all_batch_paths.append(batch_file)
                                            total_parts_downloaded += batch_size
                                            got_pdf_from_response = True
                                            logger.info("Saved inline blob: PDF to %s", batch_file)
                                            user_started_download = True
                                            try:
                                                page.go_back(wait_until="domcontentloaded", timeout=20000)
                                                page.wait_for_timeout(1000)
                                            except Exception:
                                                pass
                                            break
                                    except Exception:
                                        pass

                                if download_attempt == 0 and ("canceled" in msg or "cancelled" in msg):
                                    logger.info("Download canceled, retrying once...")
                                    page.wait_for_timeout(2000)
                                    continue

                                if "timeout" in msg or "no download started" in msg:
                                    try:
                                        page.screenshot(path=str(pdf_folder / "debug_download_timeout.png"))
                                    except Exception:
                                        pass
                                    error_msg = (
                                        "Download did not start (%ds timeout). Check backend/pdf/debug_download_timeout.png."
                                    ) % (DOWNLOAD_WAIT_MS // 1000)
                                else:
                                    error_msg = str(dl_e)
                                break

                        if error_msg:
                            break
                    if error_msg:
                        break
                    if error_msg:
                        break
                    # Before paginating, ensure any Chrome download is fully written and rename extensionless PDFs.
                    if last_download_ts:
                        _wait_for_download_dir_idle(since_ts=last_download_ts, timeout_s=120)
                        _rename_extensionless_pdfs_in_download_dir(since_ts=last_download_ts)
                    logger.info(
                        "Page %d downloads complete; automatically moving to next page (until last page).",
                        page_num + 1,
                    )
                    # Next page: use ECI control-btn set and click single ">" until it's disabled/missing.
                    page.wait_for_timeout(2000)
                    _dismiss_blocking_popups()
                    _wait_for_rate_limit_toast_gone(timeout_s=10)
                    before_sig = _parts_signature()
                    def _get_active_page_num() -> int | None:
                        try:
                            val = page.evaluate(
                                """() => {
                                    const roots = [
                                      document.querySelector('.pagination-outer'),
                                      document.querySelector('.pagination-inner'),
                                      document.querySelector("nav[aria-label*='pagination' i]"),
                                      document.querySelector('ul.pagination'),
                                      document.querySelector('.pagination'),
                                    ].filter(Boolean);
                                    const root = roots[0] || document;
                                    const active =
                                      root.querySelector('.active') ||
                                      root.querySelector('[aria-current="page"]') ||
                                      document.querySelector('.active') ||
                                      document.querySelector('[aria-current="page"]');
                                    if (!active) return null;
                                    const txt = (active.innerText || active.textContent || '').trim();
                                    const m = txt.match(/\\d+/);
                                    if (!m) return null;
                                    const n = parseInt(m[0], 10);
                                    return Number.isFinite(n) ? n : null;
                                }"""
                            )
                            return int(val) if isinstance(val, int) else None
                        except Exception:
                            return None

                    active_before = _get_active_page_num()
                    pager_root = page.locator(
                        ".pagination-outer, .pagination-inner, nav[aria-label*='pagination' i], ul.pagination, .pagination"
                    ).first
                    if pager_root.count() > 0:
                        # Best-effort: pagination can exist but be temporarily detached/hidden during React re-renders.
                        # Never hard-fail the run because of a scroll timeout.
                        try:
                            pager_root.scroll_into_view_if_needed(timeout=8000)
                        except Exception:
                            pass
                    else:
                        # If we can't find a dedicated pagination container, at least scroll near the bottom.
                        try:
                            page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
                        except Exception:
                            pass
                    page.wait_for_timeout(1000)
                    try:
                        page.screenshot(path=str(pdf_folder / f"debug_before_pagination_p{page_num + 1}.png"))
                    except Exception:
                        pass
                    try:
                        page.wait_for_selector(
                            ".pagination-outer button, .pagination-inner button, nav[aria-label*='pagination' i] button, "
                            "ul.pagination a, .pagination a, .pagination button, "
                            # ECI sometimes uses simple control buttons (<<, <, >, >>) without a pagination container.
                            "button.control-btn",
                            timeout=6000,
                        )
                    except Exception:
                        pass
                    # Prefer limiting to a pager container; if missing, only scan pagination-like regions
                    # (avoid iterating over every button on the page).
                    if pager_root.count() > 0:
                        eci_btns = pager_root.locator("button, a, [role='button']")
                    else:
                        eci_btns = page.locator(
                            ".pagination-outer button, .pagination-inner button, nav[aria-label*='pagination' i] button, "
                            ".pagination-outer a, .pagination-inner a, nav[aria-label*='pagination' i] a, "
                            "ul.pagination a, .pagination a, .pagination button, ul.pagination button, "
                            # Direct ECI pager controls observed in UI: <button class="control-btn"> &gt; </button>
                            "button.control-btn"
                        )
                    btn_count = eci_btns.count()
                    if btn_count == 0:
                        # Pagination can render late; retry briefly before deciding there's no next page.
                        for _ in range(8):
                            page.wait_for_timeout(500)
                            btn_count = eci_btns.count()
                            if btn_count > 0:
                                break
                    if btn_count == 0:
                        try:
                            page.screenshot(path=str(pdf_folder / "debug_pagination_not_found.png"))
                        except Exception:
                            pass
                        logger.info("Pagination controls not found after wait — finished all %d page(s)", page_num + 1)
                        break
                    # Find Next button (">", "Next", aria-label, icon-only).
                    # Prefer clicking the next page number (2,3,4,...) when present; it's often more reliable
                    # than icon-only buttons with empty innerText (SVG) or unstable aria-labels.
                    next_btn = None
                    # Fast-path for the exact ECI UI you showed:
                    # <button tabindex="0" class="control-btn"> &gt; </button>
                    try:
                        cand = page.locator("button.control-btn").filter(has_text=">").first
                        if cand.count() > 0:
                            try:
                                disabled_attr = cand.get_attribute("disabled")
                                aria_disabled = (cand.get_attribute("aria-disabled") or "").lower() == "true"
                                cls = (cand.get_attribute("class") or "").lower()
                                if disabled_attr is None and not aria_disabled and ("disabled" not in cls):
                                    next_btn = cand
                            except Exception:
                                next_btn = cand
                    except Exception:
                        pass
                    try:
                        active_num = active_before
                    except Exception:
                        active_num = None

                    if isinstance(active_num, int) and active_num > 0:
                        next_num = active_num + 1
                        try:
                            scope = pager_root if pager_root.count() > 0 else page.locator(
                                ".pagination-outer, .pagination-inner, nav[aria-label*='pagination' i], ul.pagination, .pagination"
                            ).first
                            if scope.count() > 0:
                                # Use exact text match so "2" doesn't match "12".
                                cand = scope.locator(
                                    f"button:text-is('{next_num}'), a:text-is('{next_num}'), [role='button']:text-is('{next_num}')"
                                ).first
                                if cand.count() > 0:
                                    next_btn = cand
                                    logger.info("Pagination: active=%d; clicking page number %d", active_num, next_num)
                        except Exception:
                            pass

                    # Fallback: locate a Next control (">", "Next", aria-label, rel=next).
                    for bi in range(btn_count):
                        b = eci_btns.nth(bi)
                        try:
                            txt = (b.inner_text() or "").strip()
                        except Exception:
                            txt = ""
                        try:
                            aria = (b.get_attribute("aria-label") or "").strip().lower()
                        except Exception:
                            aria = ""
                        try:
                            title = (b.get_attribute("title") or "").strip().lower()
                        except Exception:
                            title = ""
                        try:
                            rel = (b.get_attribute("rel") or "").strip().lower()
                        except Exception:
                            rel = ""

                        tl = (txt or "").strip().lower()
                        # Skip obvious "previous/first/last" controls.
                        if tl in ("<", "<<", "«", "‹") or "prev" in aria or "previous" in aria:
                            continue
                        if tl in (">>", "»»") or "last" in aria or "last" in title:
                            continue

                        is_next_by_label = ("next" in aria) or ("next" in title) or (rel == "next")
                        is_next_by_symbol = txt in (">", "›", "»")
                        is_next_by_text = tl == "next"
                        if next_btn is None and (is_next_by_label or is_next_by_symbol or is_next_by_text):
                            next_btn = b
                            break
                    if next_btn is None:
                        # Broader fallback outside control-btn list.
                        next_btn = page.locator(
                            ".pagination-outer button[aria-label*='next' i], .pagination-inner button[aria-label*='next' i], "
                            "nav[aria-label*='pagination' i] button[aria-label*='next' i], "
                            "ul.pagination a[rel='next'], .pagination a[rel='next'], "
                            ".pagination button[aria-label*='next' i], a:has-text('Next'), button:has-text('Next'), "
                            # Direct ECI pager controls observed in UI: <button class="control-btn"> &gt; </button>
                            "button.control-btn:has-text('>')"
                        ).first
                    if next_btn is None or next_btn.count() == 0:
                        # Fallback to known index in ECI order: <<, <, >, >>
                        if btn_count >= 3:
                            next_btn = eci_btns.nth(2)
                        else:
                            logger.info("Next button missing (last page or single page) — finished all %d page(s)", page_num + 1)
                            break
                    try:
                        disabled_attr = next_btn.get_attribute("disabled")
                        aria_disabled = (next_btn.get_attribute("aria-disabled") or "").lower() == "true"
                        cls = (next_btn.get_attribute("class") or "").lower()
                        # IMPORTANT: disabled=\"\" returns empty string, so check `is not None`, not truthiness.
                        if disabled_attr is not None or aria_disabled or ("disabled" in cls and "not-disabled" not in cls):
                            logger.info("Next disabled (last page) — finished all pagination")
                            break
                    except Exception:
                        pass
                    clicked = False
                    next_click_timeout = 25000  # Longer after rate limit / slow ECI
                    for attempt in range(3):
                        try:
                            next_btn.scroll_into_view_if_needed(timeout=5000)
                            page.wait_for_timeout(500)
                            _dismiss_blocking_popups()
                            _cursor_click(next_btn, timeout=next_click_timeout)
                            clicked = True
                            logger.info("Clicked Next → page %d (all pagination files will download automatically)", page_num + 2)
                            break
                        except Exception as click_e:
                            logger.warning("Next click failed (attempt %d): %s", attempt + 1, click_e)
                            if attempt < 2:
                                _dismiss_blocking_popups()
                                _wait_for_rate_limit_toast_gone(timeout_s=8)
                                page.wait_for_timeout(2000)
                                # Re-resolve Next button in case DOM updated (e.g. after toast)
                                try:
                                    cand = page.locator("button.control-btn").filter(has_text=">").first
                                    if cand.count() > 0:
                                        next_btn = cand
                                except Exception:
                                    pass
                            else:
                                # Final fallback: force click (overlays / React re-renders can block normal click)
                                try:
                                    next_btn.click(timeout=15000, force=True)
                                    clicked = True
                                    logger.info("Clicked Next via force click → page %d", page_num + 2)
                                except Exception:
                                    pass
                    if not clicked:
                        try:
                            clicked = page.evaluate(
                                """() => {
                                    const roots = [
                                      document.querySelector('.pagination-outer'),
                                      document.querySelector('.pagination-inner'),
                                      document.querySelector("nav[aria-label*='pagination' i]"),
                                      document.querySelector('ul.pagination'),
                                      document.querySelector('.pagination'),
                                    ].filter(Boolean);
                                    const root = roots[0] || document;
                                    const isVisible = (el) => {
                                      const r = el.getBoundingClientRect();
                                      return r.width > 0 && r.height > 0;
                                    };
                                    const isDisabled = (el) => {
                                      if (!el) return true;
                                      if (el.disabled) return true;
                                      const aria = (el.getAttribute('aria-disabled') || '').toLowerCase() === 'true';
                                      if (aria) return true;
                                      const cls = (el.className || '').toLowerCase();
                                      if (cls.includes('disabled')) return true;
                                      const li = el.closest('li');
                                      if (li && (li.className || '').toLowerCase().includes('disabled')) return true;
                                      return false;
                                    };
                                    const els = Array.from(root.querySelectorAll('a, button, [role="button"]')).filter(isVisible);
                                    const pick = (el) => {
                                      const t = (el.innerText || el.value || '').trim();
                                      const tl = t.toLowerCase();
                                      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                                      const title = (el.getAttribute('title') || '').toLowerCase();
                                      const rel = (el.getAttribute('rel') || '').toLowerCase();
                                      if (tl === '<' || tl === '<<' || tl === '«' || tl === '‹') return false;
                                      if (aria.includes('prev') || aria.includes('previous')) return false;
                                      if (tl === '>>' || tl === '»»') return false;
                                      if (aria.includes('last') || title.includes('last')) return false;
                                      return (
                                        aria.includes('next') ||
                                        title.includes('next') ||
                                        rel === 'next' ||
                                        tl === 'next' ||
                                        t === '>' || t === '›' || t === '»'
                                      );
                                    };
                                    const cand = els.find(pick);
                                    if (!cand || isDisabled(cand)) return false;
                                    cand.click();
                                    return true;
                                }"""
                            )
                            if clicked:
                                logger.info("Next clicked via JS → page %d", page_num + 2)
                        except Exception:
                            pass
                    if clicked:
                        # Confirm page changed.
                        # Prefer waiting for active page number to change; fallback to signature comparison.
                        changed = False
                        if isinstance(active_before, int) and active_before > 0:
                            try:
                                page.wait_for_function(
                                    """(prev) => {
                                        const roots = [
                                          document.querySelector('.pagination-outer'),
                                          document.querySelector('.pagination-inner'),
                                          document.querySelector("nav[aria-label*='pagination' i]"),
                                          document.querySelector('ul.pagination'),
                                          document.querySelector('.pagination'),
                                        ].filter(Boolean);
                                        const root = roots[0] || document;
                                        const active =
                                          root.querySelector('.active') ||
                                          root.querySelector('[aria-current="page"]') ||
                                          document.querySelector('.active') ||
                                          document.querySelector('[aria-current="page"]');
                                        if (!active) return false;
                                        const txt = (active.innerText || active.textContent || '').trim();
                                        const m = txt.match(/\\d+/);
                                        if (!m) return false;
                                        const n = parseInt(m[0], 10);
                                        return Number.isFinite(n) && n !== prev;
                                    }""",
                                    arg=active_before,
                                    timeout=15000,
                                )
                                changed = True
                            except Exception:
                                changed = False
                        if not changed:
                            for _ in range(30):  # ~15s
                                page.wait_for_timeout(500)
                                _dismiss_blocking_popups()
                                after_sig = _parts_signature()
                                if after_sig and after_sig != before_sig:
                                    changed = True
                                    break
                        if not changed:
                            try:
                                clicked2 = page.evaluate("""() => {
                                    const root =
                                      document.querySelector('.pagination-outer') ||
                                      document.querySelector('.pagination-inner') ||
                                      document.querySelector("nav[aria-label*='pagination' i]") ||
                                      document.querySelector('ul.pagination') ||
                                      document.querySelector('.pagination') ||
                                      document;
                                    const els = Array.from(root.querySelectorAll('button, a'));
                                    const isVisible = (el) => {
                                      const r = el.getBoundingClientRect();
                                      return r.width > 0 && r.height > 0;
                                    };
                                    const candidates = els.filter(isVisible).filter(el => {
                                      const t = (el.innerText || el.value || '').trim();
                                      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                                      const title = (el.getAttribute('title') || '').toLowerCase();
                                      const rel = (el.getAttribute('rel') || '').toLowerCase();
                                      if (t === '<<' || t === '<' || t === '«' || t === '‹') return false;
                                      if (t === '>>' || t === '»»') return false;
                                      if (aria.includes('previous') || aria.includes('prev')) return false;
                                      if (aria.includes('last') || title.includes('last')) return false;
                                      return (
                                        t === '>' || t === '›' || t === '»' ||
                                        t.toLowerCase() === 'next' ||
                                        aria.includes('next') ||
                                        title.includes('next') ||
                                        rel === 'next'
                                      );
                                    });
                                    if (!candidates.length) return false;
                                    const el = candidates[0];
                                    if (el.disabled) return false;
                                    el.click();
                                    return true;
                                }""")
                                if clicked2:
                                    # Wait a bit more for change.
                                    try:
                                        if isinstance(active_before, int) and active_before > 0:
                                            page.wait_for_function(
                                                """(prev) => {
                                                    const roots = [
                                                      document.querySelector('.pagination-outer'),
                                                      document.querySelector('.pagination-inner'),
                                                      document.querySelector("nav[aria-label*='pagination' i]"),
                                                      document.querySelector('ul.pagination'),
                                                      document.querySelector('.pagination'),
                                                    ].filter(Boolean);
                                                    const root = roots[0] || document;
                                                    const active =
                                                      root.querySelector('.active') ||
                                                      root.querySelector('[aria-current="page"]') ||
                                                      document.querySelector('.active') ||
                                                      document.querySelector('[aria-current="page"]');
                                                    if (!active) return false;
                                                    const txt = (active.innerText || active.textContent || '').trim();
                                                    const m = txt.match(/\\d+/);
                                                    if (!m) return false;
                                                    const n = parseInt(m[0], 10);
                                                    return Number.isFinite(n) && n !== prev;
                                                }""",
                                                arg=active_before,
                                                timeout=15000,
                                            )
                                            changed = True
                                    except Exception:
                                        changed = False
                                    if not changed:
                                        for _ in range(30):
                                            page.wait_for_timeout(500)
                                            after_sig = _parts_signature()
                                            if after_sig and after_sig != before_sig:
                                                changed = True
                                                break
                            except Exception:
                                pass
                        if not changed:
                            try:
                                page.screenshot(path=str(pdf_folder / "debug_pagination_no_change.png"))
                            except Exception:
                                pass
                            logger.warning("Pagination click did not change the table; stopping after %d page(s)", page_num + 1)
                            break
                        try:
                            page.screenshot(path=str(pdf_folder / f"debug_after_pagination_p{page_num + 1}.png"))
                        except Exception:
                            pass
                    if not clicked:
                        logger.info("Could not click Next — stopping after %d page(s)", page_num + 1)
                        break
                    page.wait_for_timeout(2500)
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=10000)
                    except Exception:
                        pass
                    # Wait for next page's parts table to load (same as last page).
                    for _ in range(40):
                        page.wait_for_timeout(500)
                        _dismiss_blocking_popups()
                        n_now = page.locator(
                            "table.contenttable-eroll tbody tr input[type='checkbox'], "
                            ".datatable-box tbody tr input[type='checkbox'], "
                            "table.datatable-box tbody tr input[type='checkbox']"
                        ).count()
                        if n_now > 0:
                            break
                    page.wait_for_timeout(800)
                if not error_msg and all_batch_paths:
                    if len(all_batch_paths) == 1:
                        pdf_bytes = all_batch_paths[0].read_bytes()
                        _save_pdf_file(pdf_path, pdf_bytes)
                        logger.info("Saved single batch PDF to %s", pdf_path)
                    else:
                        try:
                            import fitz
                            merged = fitz.open()
                            for p in all_batch_paths:
                                doc = fitz.open(str(p))
                                merged.insert_pdf(doc)
                                doc.close()
                            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                                merged.save(tmp.name, garbage=4, deflate=True)
                                merged.close()
                                pdf_bytes = Path(tmp.name).read_bytes()
                            try:
                                os.unlink(tmp.name)
                            except OSError:
                                pass
                            _save_pdf_file(pdf_path, pdf_bytes)
                            logger.info("Merged %d batch PDFs into %s (%d part(s))", len(all_batch_paths), pdf_path, total_parts_downloaded)
                        except Exception as merge_e:
                            logger.warning("Could not merge batch PDFs: %s; using first only", merge_e)
                            pdf_bytes = all_batch_paths[0].read_bytes()
                            _save_pdf_file(pdf_path, pdf_bytes)
                elif not error_msg and not all_batch_paths:
                    error_msg = "No PDFs were downloaded. Ensure parts are selected and the ECI server is responding."
        except Exception as e:
            logger.exception("ECI download automation failed")
            err_str = str(e)
            if "canceled" in err_str.lower() or "cancelled" in err_str.lower():
                error_msg = (
                    "Download was canceled or the connection was closed. "
                    "Please try again and wait for the download to complete (may take 2–5 minutes)."
                )
            elif "err_internet_disconnected" in err_str.lower() or "err_connection" in err_str.lower() or "err_network" in err_str.lower():
                error_msg = (
                    "No internet connection. Please check your network and try again."
                )
            elif "target" in err_str.lower() and "closed" in err_str.lower():
                error_msg = (
                    "Browser window was closed. Please run the download again and keep the browser window open until it finishes."
                )
            else:
                error_msg = err_str
        finally:
            if context:
                try:
                    context.close()
                except Exception:
                    pass
            if user_data_dir and "playwright_eci_" in str(user_data_dir):
                try:
                    shutil.rmtree(user_data_dir, ignore_errors=True)
                except Exception:
                    pass

    return pdf_bytes, error_msg


def download_eci_roll_via_subprocess(
    state: str = DEFAULT_STATE,
    revyear: str = DEFAULT_REVYEAR,
    district: str = DEFAULT_DISTRICT,
    ac_name: str = DEFAULT_AC_NAME,
    language: str = "English",
    timeout_seconds: int = 600,
    manual_captcha: bool = True,
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Run ECI download in a separate Python process to avoid Windows event loop conflicts.
    Default: automatic captcha (OCR). Use manual_captcha=True to type in browser.
    Returns (pdf_bytes, error_msg).
    """
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "run_eci_download.py"
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        out_path = tmp.name
    try:
        cmd = [
            sys.executable,
            str(script_path),
            "--output",
            out_path,
            "--state",
            state,
            "--revyear",
            revyear,
            "--district",
            district,
            "--ac",
            ac_name,
            "--language",
            (language or "English").strip(),
        ]
        # scripts/run_eci_download.py defaults to manual captcha; pass --no-manual-captcha for OCR.
        if not manual_captcha:
            cmd.append("--no-manual-captcha")
        env = {
            **os.environ,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONPATH": str(backend_dir),
        }
        proc = subprocess.run(
            cmd,
            cwd=str(backend_dir),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            env=env,
        )
        if proc.returncode != 0:
            err_parts = [proc.stderr, proc.stdout] if proc.stderr != proc.stdout else [proc.stderr or proc.stdout]
            err = "\n".join((p or "").strip() for p in err_parts if (p or "").strip()).strip()
            if not err:
                err = "ECI download script failed"
            return None, err
        if not Path(out_path).exists():
            return None, "No PDF was saved"
        pdf_bytes = Path(out_path).read_bytes()
        return pdf_bytes, None
    except subprocess.TimeoutExpired:
        return None, f"ECI download timed out ({timeout_seconds}s)"
    except Exception as e:
        logger.exception("ECI subprocess failed")
        return None, str(e)
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass
