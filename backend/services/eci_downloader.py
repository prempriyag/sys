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
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

ECI_DOWNLOAD_URL = "https://voters.eci.gov.in/download-eroll"

# Default form values (overridable via API/script args)
DEFAULT_STATE = "Andhra Pradesh"
DEFAULT_REVYEAR = "2025"
DEFAULT_DISTRICT = "Kurnool"
DEFAULT_AC_NAME = "Kurnool"
MAX_CAPTCHA_RETRIES = 5


def _ocr_captcha(base64_img: str) -> str:
    """Read captcha text from base64 image using Tesseract or EasyOCR."""
    raw = base64_img.split(",")[-1] if "," in base64_img else base64_img
    img_data = base64.b64decode(raw)
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(img_data))
        text = pytesseract.image_to_string(img, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        return re.sub(r"[^A-Za-z0-9]", "", text.strip())[:6]
    except Exception as e1:
        logger.warning("Tesseract captcha OCR failed: %s", e1)
        try:
            import easyocr
            import numpy as np
            from PIL import Image
            reader = easyocr.Reader(["en"], gpu=False)
            img_arr = np.array(Image.open(io.BytesIO(img_data)))
            results = reader.readtext(img_arr)
            text = "".join(r[1] for r in results)
            return re.sub(r"[^A-Za-z0-9]", "", text.strip())[:6]
        except Exception as e2:
            logger.warning("EasyOCR captcha fallback failed: %s", e2)
            raise RuntimeError(f"Captcha OCR failed: {e1}")


def _get_pdf_folder() -> Path:
    """Return backend/pdf folder path. Create if missing."""
    folder = Path(__file__).resolve().parent.parent / "pdf"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _select_district(page, district: str) -> bool:
    """Select district using multiple strategies. Returns True if successful."""
    page.wait_for_timeout(1500)  # Options load after State
    # Try 1: select[name="district"]
    dist_select = page.locator('select[name="district"]').first
    if dist_select.count() > 0:
        try:
            dist_select.select_option(label=district)
            return True
        except Exception:
            try:
                dist_select.select_option(value=district)
                return True
            except Exception:
                pass
    # Try 2: select#district, [name="districtCode"]
    for sel in ['select#district', 'select[name="districtCode"]']:
        el = page.locator(sel).first
        if el.count() > 0:
            try:
                el.select_option(label=district)
                return True
            except Exception:
                pass
    # Try 3: react-select for district (first react-select before AC)
    dist_input = page.locator('[id*="react-select"][id*="-input"]').first
    if dist_input.count() > 0:
        dist_input.click()
        page.wait_for_timeout(300)
        dist_input.fill(district)
        page.wait_for_timeout(600)
        page.keyboard.press("Enter")
        page.wait_for_timeout(800)
        return True
    return False


def download_eci_roll_sync(
    state: str = DEFAULT_STATE,
    revyear: str = DEFAULT_REVYEAR,
    district: str = DEFAULT_DISTRICT,
    ac_name: str = DEFAULT_AC_NAME,
    timeout_ms: int = 120000,
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

    pdf_folder = _get_pdf_folder()
    pdf_path = pdf_folder / f"eci_electoral_roll_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf_bytes = None
    error_msg = None

    with sync_playwright() as p:
        browser = None
        try:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            context.set_default_timeout(timeout_ms)
            page = context.new_page()
            page.set_default_timeout(timeout_ms)

            logger.info("Navigating to ECI download page...")
            page.goto(ECI_DOWNLOAD_URL, wait_until="networkidle")

            # 1. Select State (stateCode)
            state_select = page.locator('select[name="stateCode"], [name="stateCode"]').first
            if state_select.count() > 0:
                state_select.select_option(label=state)
            else:
                page.locator("text=" + state).first.click()
            page.wait_for_timeout(1500)

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

            # 3. Set roleType (first value)
            role_select = page.locator('select[name="roleType"], [name="roleType"]').first
            if role_select.count() > 0:
                options = role_select.locator("option").all()
                if options:
                    role_select.select_option(index=1)

            # 4. Select District (must be before AC)
            if not _select_district(page, district):
                logger.warning("District selection may have failed, continuing...")
            page.wait_for_timeout(1500)  # AC options load after District

            # 5. Select Assembly Constituency (react-select; depends on District)
            ac_selector = page.locator('[id*="react-select"][id*="-input"]').last
            if ac_selector.count() > 0:
                ac_selector.click()
                page.wait_for_timeout(300)
                ac_selector.fill(ac_name)
                page.wait_for_timeout(500)
                page.keyboard.press("Enter")

            # 6. Captcha + Submit with retry on invalid captcha
            parts_table_loaded = False
            for attempt in range(MAX_CAPTCHA_RETRIES):
                page.wait_for_timeout(800)
                captcha_img = page.locator('img[src^="data:image"][alt="captcha"], img[alt="captcha"]').first
                if captcha_img.count() > 0:
                    src = captcha_img.get_attribute("src")
                    if src:
                        try:
                            captcha_text = _ocr_captcha(src)
                            cap_input = page.locator('input[name="captcha"]').first
                            if cap_input.count() > 0:
                                cap_input.fill(captcha_text)
                        except Exception as e:
                            error_msg = f"Captcha OCR failed: {e}"
                            return None, error_msg

                submit_btn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Search")').first
                if submit_btn.count() > 0:
                    submit_btn.click()
                page.wait_for_timeout(2500)

                if page.locator("table.contenttable-eroll, .datatable-box").count() > 0:
                    parts_table_loaded = True
                    break

                # Parts table didn't load - likely invalid captcha; click refresh img to get new captcha
                logger.info("Invalid captcha, clicking refresh to get new captcha (%d/%d)...", attempt + 1, MAX_CAPTCHA_RETRIES)
                refresh_img = page.locator('img[alt="refresh"], img[src*="refresh"]').first
                if refresh_img.count() > 0:
                    refresh_img.click()
                else:
                    captcha_img_el = page.locator('img[alt="captcha"]').first
                    if captcha_img_el.count() > 0:
                        captcha_img_el.click()
                page.wait_for_timeout(1500)

            if not parts_table_loaded:
                error_msg = "Could not load parts table (invalid captcha or form error)"
                return None, error_msg

            # 7. Select first row checkbox
            first_checkbox = page.locator(".datatable-box input[type='checkbox']").nth(1)
            if first_checkbox.count() == 0:
                first_checkbox = page.locator("table.contenttable-eroll tbody tr input[type='checkbox']").first
            if first_checkbox.count() > 0:
                first_checkbox.check()

            # 8. Download to backend/pdf
            page.wait_for_timeout(500)
            download_btn = page.locator('button:has-text("Download Selected PDFs"), input[value="Download Selected PDFs"]').first
            if download_btn.count() == 0:
                download_btn = page.locator('button.submit:has-text("Download")').first
            if download_btn.count() > 0:
                with page.expect_download() as download_info:
                    download_btn.click()
                download = download_info.value
                path = download.path()
                if path and Path(path).exists():
                    pdf_bytes = Path(path).read_bytes()
                    pdf_path.write_bytes(pdf_bytes)
                    logger.info("Saved PDF to %s", pdf_path)
            else:
                error_msg = "Could not find Download Selected PDFs button"
        except Exception as e:
            logger.exception("ECI download automation failed")
            error_msg = str(e)
        finally:
            if browser:
                browser.close()

    return pdf_bytes, error_msg


def download_eci_roll_via_subprocess(
    state: str = DEFAULT_STATE,
    revyear: str = DEFAULT_REVYEAR,
    district: str = DEFAULT_DISTRICT,
    ac_name: str = DEFAULT_AC_NAME,
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Run ECI download in a separate Python process to avoid Windows event loop conflicts.
    Spawns: python -m scripts.run_eci_download --output <tmp> ...
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
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(backend_dir),
            capture_output=True,
            text=True,
            timeout=180,
        )
        if proc.returncode != 0:
            err = proc.stderr or proc.stdout or "Unknown error"
            return None, err.strip() or "ECI download script failed"
        if not Path(out_path).exists():
            return None, "No PDF was saved"
        pdf_bytes = Path(out_path).read_bytes()
        return pdf_bytes, None
    except subprocess.TimeoutExpired:
        return None, "ECI download timed out (180s)"
    except Exception as e:
        logger.exception("ECI subprocess failed")
        return None, str(e)
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass
