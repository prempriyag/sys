"""
EPIC validation + auto-repair module (production-ready).
Aligns with extract_electoral_roll_csv_strict.py: format check, prefix correction,
letter/digit confusion repair for 7 lakh+ records.
"""
import re
from typing import Optional, Tuple

# Strict: 3 letters + 7 digits
RE_EPIC_STRICT = re.compile(r"^[A-Z]{3}[0-9]{7}$")
# Flexible for OCR: alphanumeric 9-12 chars before cleanup
RE_EPIC_FLEX = re.compile(r"[A-Z0-9]{9,12}")

ALLOWED_PREFIXES = ("WQD", "WOD", "FBT", "ABC", "XYZ", "TMB", "TN", "AP", "KL", "KA", "DL", "MH", "WB", "UP", "RJ", "PB", "HR", "GJ")

# Letter/digit confusion (strict script style): prefix = letters only, tail = digits
# In prefix: digits read as letters
PREFIX_DIGIT_TO_LETTER = str.maketrans({"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B"})
# In tail: letters read as digits
TAIL_LETTER_TO_DIGIT = str.maketrans({
    "O": "0", "Q": "0", "D": "0",
    "I": "1", "L": "1",
    "Z": "2", "S": "5", "B": "8", "G": "6",
})

# Prefix confusion cost (strict script): (wrong_char, right_char) -> cost
PREFIX_CONFUSION_COST = {
    ("O", "Q"): 0.3, ("Q", "O"): 0.3,
    ("O", "D"): 0.4, ("D", "O"): 0.4,
    ("C", "Q"): 0.4, ("Q", "C"): 0.4,
    ("I", "T"): 0.5, ("T", "I"): 0.5,
    ("B", "D"): 0.6, ("D", "B"): 0.6,
}


def validate_epic(epic: Optional[str]) -> bool:
    """Return True if epic matches 3 letters + 7 digits."""
    if not epic or not isinstance(epic, str):
        return False
    s = re.sub(r"[^A-Z0-9]", "", epic.upper())
    return bool(RE_EPIC_STRICT.match(s))


def _normalize_epic_candidate(token: str) -> str:
    """
    Try to repair OCR errors in one token: overrun/underrun and letter-digit confusion.
    Returns repaired 10-char EPIC or empty string.
    """
    token = re.sub(r"[^A-Z0-9]", "", (token or "").upper())
    if not token:
        return ""

    candidates = [token]
    if len(token) > 10:
        for i in range(len(token)):
            candidates.append(token[:i] + token[i + 1:])
    elif len(token) < 10:
        return ""

    for c in candidates:
        if len(c) != 10:
            continue
        head = c[:3].translate(PREFIX_DIGIT_TO_LETTER)
        tail = c[3:].translate(TAIL_LETTER_TO_DIGIT)
        n = head + tail
        if RE_EPIC_STRICT.match(n):
            return n
    return ""


def _normalize_epic_prefix(epic: str) -> str:
    """Apply prefix correction: WOD->WQD, or best allowed prefix by confusion cost."""
    epic = (epic or "").upper()
    if len(epic) < 10:
        return epic
    prefix = epic[:3]
    rest = epic[3:]

    if prefix == "WOD":
        return "WQD" + rest
    if prefix in ALLOWED_PREFIXES:
        return epic

    def cost(a: str, b: str) -> float:
        c = 0.0
        for x, y in zip(a, b):
            if x == y:
                continue
            c += PREFIX_CONFUSION_COST.get((x, y), 1.0)
        return c

    ranked = sorted(((p, cost(prefix, p)) for p in ALLOWED_PREFIXES), key=lambda t: t[1])
    best_prefix, best_cost = ranked[0]
    if best_cost <= 1.2:
        return best_prefix + rest
    return epic


def repair_epic(epic: Optional[str]) -> Tuple[str, bool]:
    """
    Validate and auto-repair EPIC. Returns (repaired_epic, was_repaired).
    Steps: strip/slash removal -> strict match -> candidate repair (letter/digit) -> prefix correction.
    """
    if not epic or not isinstance(epic, str):
        return (epic or ""), False
    raw = epic.strip().upper().replace(" ", "")
    raw = re.sub(r"(\d)/(\d)", r"\1\2", raw)
    if len(raw) < 9:
        return raw, False

    if RE_EPIC_STRICT.match(raw):
        return _normalize_epic_prefix(raw), False

    tokens = RE_EPIC_FLEX.findall(raw)
    for tok in tokens:
        tok_clean = re.sub(r"[^A-Z0-9]", "", tok.upper())
        if RE_EPIC_STRICT.match(tok_clean):
            return _normalize_epic_prefix(tok_clean), True

    for tok in tokens:
        repaired = _normalize_epic_candidate(tok)
        if repaired:
            return _normalize_epic_prefix(repaired), True

    if len(raw) >= 10:
        repaired = _normalize_epic_candidate(raw[:10])
        if repaired:
            return _normalize_epic_prefix(repaired), True

    return _normalize_epic_prefix(raw) if len(raw) >= 10 else raw, False


def epic_confidence_score(epic: Optional[str]) -> float:
    """Return 0-1 confidence: format + allowed prefix + length 10."""
    if not epic or not isinstance(epic, str):
        return 0.0
    s = re.sub(r"[^A-Z0-9]", "", epic.upper())
    score = 0.0
    if RE_EPIC_STRICT.match(s):
        score += 0.6
    if len(s) >= 3 and s[:3] in ALLOWED_PREFIXES:
        score += 0.3
    if len(s) == 10:
        score += 0.1
    return round(min(1.0, score), 2)
