"""
Record Segmentation Layer - SIR PDF Extraction
Ensures correct grouping of OCR text into one-block-per-voter before parsing.
Handles: EPIC-based split (sequential), grid reordering (column-major OCR), anomaly detection.
"""
import re
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

RE_EPIC = re.compile(r"^[A-Za-z][A-Za-z0-9]*[0-9]{3,}(/[0-9]+)?$", re.IGNORECASE)
RE_EPIC_ANYWHERE = re.compile(r"[A-Za-z][A-Za-z0-9]*[0-9]{3,}(/[0-9]+)?")
RE_NAME_LABEL = re.compile(r"^(?:name|nama|namo|namc|namne|narne)\s*[:\-]?\s*", re.IGNORECASE)
RE_AGE_LABEL = re.compile(r"(?:age|ago|aga)\s*[:\-]?\s*", re.IGNORECASE)
RE_GENDER_WORD = re.compile(r"\b(?:male|female|m|f|mala|ferala)\b", re.IGNORECASE)


def segment_by_epic(text: str) -> List[Tuple[str, List[str]]]:
    """
    Split page text by EPIC positions. Each block = one EPIC + lines until next EPIC.
    Returns list of (epic, lines) for sequential/card-major OCR output.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    blocks: List[Tuple[str, List[str]]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if RE_EPIC.match(line):
            epic = line
            block: List[str] = [line]
            i += 1
            while i < len(lines):
                if RE_EPIC.match(lines[i]):
                    break
                block.append(lines[i])
                i += 1
            blocks.append((epic, block))
        else:
            i += 1
    return blocks


def _find_epic_positions(lines: List[str]) -> List[Tuple[int, str]]:
    """Return [(index, epic), ...] for each EPIC in order."""
    return [(i, lines[i].strip()) for i in range(len(lines)) if RE_EPIC.match(lines[i].strip())]


def segment_by_epic_with_indices(lines: List[str]) -> List[Tuple[int, int, str]]:
    """
    Find EPIC positions and return (start_idx, end_idx, epic) for each block.
    """
    result: List[Tuple[int, int, str]] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if RE_EPIC.match(line):
            start = i
            epic = line
            i += 1
            while i < len(lines) and not RE_EPIC.match(lines[i].strip()):
                i += 1
            end = i
            result.append((start, end, epic))
        else:
            i += 1
    return result


def detect_grid_layout(lines: List[str]) -> Tuple[bool, int, int]:
    """
    Detect if OCR output is grid (EPICs in rows, then row-major field data).
    Returns (is_grid, num_cols, total_cards).
    """
    epic_pos = _find_epic_positions(lines)
    if len(epic_pos) < 2:
        return False, 0, 0
    total_cards = len(epic_pos)
    num_cols = total_cards
    # Infer cols from first row: consecutive EPICs at start
    i = 0
    while i < len(lines) and RE_EPIC.match(lines[i].strip()):
        i += 1
    num_cols = i
    if num_cols < 1:
        return False, 0, 0
    rows_of_cards = (total_cards + num_cols - 1) // num_cols
    return True, num_cols, min(total_cards, num_cols * rows_of_cards)


def reorder_grid_to_cards(
    lines: List[str],
    num_cols: int,
    rows_of_cards: int = 1,
) -> List[List[str]]:
    """
    Reorder row-major grid into per-card blocks.
    Layout: EPIC1..EPICn (may have serials between), [row of n items], ... EPIC(n+1).., ...
    """
    total_cards = num_cols * rows_of_cards
    epic_pos = _find_epic_positions(lines)
    if len(epic_pos) < num_cols:
        return []
    # Group EPIC positions into rows (each row has num_cols EPICs)
    epic_rows: List[List[Tuple[int, str]]] = []
    for r in range(rows_of_cards):
        start = r * num_cols
        end = min(start + num_cols, len(epic_pos))
        epic_rows.append(epic_pos[start:end])
    if not epic_rows:
        return []
    cards: List[List[str]] = []
    for row_idx, row_epics in enumerate(epic_rows):
        last_epic_idx = row_epics[-1][0]  # line index of last EPIC in this row
        if row_idx + 1 < len(epic_rows):
            next_first = epic_rows[row_idx + 1][0][0]
            data_end = next_first
        else:
            data_end = len(lines)
        # Data starts after last EPIC of this row (handles serials between EPICs, e.g. "10" "WQD" "FBT" "12" "WQD")
        data_start = last_epic_idx + 1
        data_lines = lines[data_start:data_end]
        # Row-major: data_lines = [r0c0, r0c1, r0c2, r1c0, r1c1, r1c2, ...]
        items_per_col = len(data_lines) // num_cols if num_cols else 0
        if items_per_col < 1:
            for epic in row_epics:
                cards.append([epic[1]])
            continue
        for col_idx in range(num_cols):
            block = [row_epics[col_idx][1]]
            for row_offset in range(items_per_col):
                idx = row_offset * num_cols + col_idx
                if idx < len(data_lines) and data_lines[idx].strip():
                    block.append(data_lines[idx].strip())
            cards.append(block)
    return cards[:total_cards]


def segment_page_text(
    text: str,
    cards_per_row: int = 3,
    rows_per_page: int = 2,
) -> List[List[str]]:
    """
    Main entry: segment page text into one-block-per-card.
    Tries: (1) Grid reorder (EPICs first, row-major data), (2) EPIC-based split (sequential layout).
    Must try grid FIRST — otherwise EPIC-split returns only every 3rd block (3,6,9,12) with mixed data.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []
    # 1) Grid layout first: when EPICs appear in rows (EPIC1,EPIC2,EPIC3, data, EPIC4,EPIC5,EPIC6, ...)
    is_grid, num_cols, total_cards = detect_grid_layout(lines)
    if is_grid and num_cols >= 2 and total_cards >= 3:
        rows_of_cards = max(1, (total_cards + num_cols - 1) // num_cols)
        cards = reorder_grid_to_cards(lines, num_cols, rows_of_cards)
        if cards and len(cards) >= 3:  # Expect multiple cards for grid
            return cards
    # 2) EPIC-based split: sequential layout (EPIC1,Name1,Father1,...,EPIC2,Name2,...)
    epic_indices = segment_by_epic_with_indices(lines)
    if epic_indices:
        blocks = []
        for start, end, epic in epic_indices:
            block = lines[start:end]
            if len(block) >= 4:  # EPIC + at least name/father/house
                blocks.append(block)
        if blocks:
            return blocks
    return []


def count_structural_anomalies(block: List[str]) -> List[str]:
    """
    Detect possible cross-card merge: >1 Name label, >1 Age, >1 Gender in one block.
    """
    anomalies: List[str] = []
    name_count = sum(1 for ln in block if RE_NAME_LABEL.match(ln.strip()))
    age_count = sum(1 for ln in block if RE_AGE_LABEL.search(ln) or re.match(r"^\d{1,3}\s+(?:gender|gerer|gerder)", ln.strip(), re.I))
    gender_count = len(RE_GENDER_WORD.findall(" ".join(block)))
    if name_count > 1:
        anomalies.append("multiple_name_labels")
    if age_count > 2:  # Allow "Age" + "32 Gender" as 2
        anomalies.append("multiple_age_labels")
    if gender_count > 1:
        anomalies.append("multiple_gender_values")
    return anomalies
