"""
Ultra-accurate EPIC auto-repair for OCR errors.
Standard format: 3 uppercase letters + 7 digits (e.g. ABC1234567).
"""
import re
from typing import Optional, Tuple

EPIC_REGEX = re.compile(r"^[A-Z]{3}[0-9]{7}$")

# Common OCR substitutions (digit/letter confusions)
OCR_FIX_MAP = {
    "O": "0",
    "I": "1",
    "L": "1",
    "Z": "2",
    "S": "5",
    "B": "8",
    "G": "6",
    "0": "O",
    "1": "I",
    "5": "S",
    "8": "B",
    "6": "G",
}
# Letter-position fixes (e.g. HAG -> HRG)
LETTER_ALTERNATIVES = [
    ("A", "R"),
    ("R", "A"),
    ("O", "Q"),
    ("Q", "O"),
]


def repair_epic(raw_epic: Optional[str]) -> Tuple[Optional[str], float]:
    """
    Validate and repair EPIC (3 letters + 7 digits). Returns (repaired_epic, confidence).
    confidence 1.0 = already valid; 0.95 = repaired; 0.0 = invalid.
    """
    if not raw_epic or not isinstance(raw_epic, str):
        return None, 0.0

    raw = raw_epic.upper().strip()
    raw = re.sub(r"[^A-Z0-9]", "", raw)

    if len(raw) != 10:
        return None, 0.0

    prefix, digits = raw[:3], raw[3:10]

    # Direct match
    if EPIC_REGEX.fullmatch(raw):
        return raw, 1.0

    # Repair digits (OCR letter->digit)
    repaired_digits = ""
    for ch in digits:
        if ch.isdigit():
            repaired_digits += ch
        elif ch in OCR_FIX_MAP and OCR_FIX_MAP[ch].isdigit():
            repaired_digits += OCR_FIX_MAP[ch]
        else:
            repaired_digits += ch
    candidate = prefix + repaired_digits
    if EPIC_REGEX.fullmatch(candidate):
        return candidate, 0.95

    # Try letter-position fixes in prefix (e.g. HAG -> HRG)
    for wrong, right in LETTER_ALTERNATIVES:
        for i in range(3):
            try_prefix = prefix[:i] + right + prefix[i + 1:]
            if prefix[i] == wrong and EPIC_REGEX.fullmatch(try_prefix + repaired_digits):
                return try_prefix + repaired_digits, 0.9

    return None, 0.0
