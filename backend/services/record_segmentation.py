"""
Record Segmentation Layer - SIR PDF Extraction

Three segmentation strategies, tried in order:
  1. Section-based (field-parallel): all EPICs appear first, then all names, etc.
     Identifies each field section, then zips by index to reconstruct per-card blocks.
     This is the correct approach for pdfplumber/EasyOCR flat-text output.

  2. Grid reorder: EPICs appear in rows of num_cols, followed by field-parallel data
     for that row. Uses Name labels as card boundaries within each row's data section.

  3. EPIC-based split (fallback): sequential layout where each card's fields follow
     its EPIC directly (EPIC1, Name1, Father1, ..., EPIC2, Name2, ...).
"""
import re
import logging
from collections import defaultdict
from typing import List, Tuple, Optional, Dict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared regex patterns
# ---------------------------------------------------------------------------
# Matches EPICs like WQD2616720, WQD2/24243, WOD22/2193, FBT2224673
# Allows optional slash(es) within the numeric portion (OCR artefact)
RE_EPIC = re.compile(r"^[A-Za-z][A-Za-z0-9]{1,4}[0-9][0-9/]{2,}[0-9]$", re.IGNORECASE)
RE_EPIC_ANYWHERE = re.compile(r"[A-Za-z][A-Za-z0-9]{1,4}[0-9][0-9/]{2,}[0-9]")

RE_NAME_LABEL = re.compile(
    r"^(?:name|nama|namo|namc|namne|narne|nana|nane|nara|narm|nam)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_FATHER_LABEL = re.compile(
    r"^(?:father|falher|fatner|fathcr|fathar|fathe|fath)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_HUSBAND_LABEL = re.compile(
    r"^(?:husband|husoand|huspand|husbend|hushand)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_MOTHER_LABEL = re.compile(
    r"^(?:mother|mothar|mothe)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_HOUSE_LABEL = re.compile(
    r"^(?:house|houso|housa|hcuso|huusa|hause|hou?se?)\s*"
    r"(?:num|numb|number|numoor|numnbur|numiber|nurnber|numbci|numbor|numper|no|nbr?|no\.?)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_AGE_LABEL = re.compile(r"^(?:age|ago|aga|ag)\s*[:\-]?\s*", re.IGNORECASE)
RE_GENDER_LABEL = re.compile(
    r"\b(?:gender|gende|gande|gerder|gen?d?e?r?)\s*[:\-]?\s*",
    re.IGNORECASE,
)
RE_AVAIL = re.compile(
    r"^(?:available|avallable|avallablo|availablc|avalable|availa?b?l?e?|avail)\s*$",
    re.IGNORECASE,
)
RE_PHOTO = re.compile(r"^(?:photo|pnoto|fhoto|foto)\s*$", re.IGNORECASE)
RE_SERIAL = re.compile(r"^\d{1,4}$")

RE_AGE_LABEL_GLOBAL = re.compile(r"(?:age|ago|aga)\s*[:\-]?\s*", re.IGNORECASE)
RE_GENDER_WORD = re.compile(r"\b(?:male|female|m|f|mala|ferala)\b", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Field-type classifier
# ---------------------------------------------------------------------------

def _field_type(line: str) -> Optional[str]:
    """Return the field type a line belongs to, or None if unrecognised."""
    s = line.strip()
    if RE_EPIC.match(s):
        return "epic"
    if RE_NAME_LABEL.match(s):
        return "name"
    if RE_FATHER_LABEL.match(s) or RE_HUSBAND_LABEL.match(s) or RE_MOTHER_LABEL.match(s):
        return "relative"
    if RE_HOUSE_LABEL.match(s):
        return "house"
    if RE_AGE_LABEL.match(s):
        return "age_gender"
    if RE_AVAIL.match(s):
        return "available"
    if RE_PHOTO.match(s):
        return "photo"
    if RE_SERIAL.match(s):
        return "serial"
    return None


# ---------------------------------------------------------------------------
# Strategy 1 — Section-based reconstruction (field-parallel layout)
# ---------------------------------------------------------------------------

def _collect_sections(lines: List[str]) -> Dict[str, List[List[str]]]:
    """
    Walk lines and group them into named sections.
    Each section entry is a list of lines belonging to one card's value for that field.

    Returns dict: { "epic": [[epic1], [epic2], ...],
                    "name": [[label, val], [label, val], ...],
                    "relative": [[label_val], ...],
                    "house": [[label, val, photo?], ...],
                    "age_gender": [[label, val, gender?], ...],
                    "available": [["Available"], ...],
                    "serial": [["1"], ["2"], ...] }
    """
    sections: Dict[str, List[List[str]]] = defaultdict(list)
    current_type: Optional[str] = None
    current_chunk: List[str] = []

    def _flush():
        if current_type and current_chunk:
            sections[current_type].append(list(current_chunk))

    for line in lines:
        s = line.strip()
        if not s:
            continue
        ft = _field_type(s)
        if ft is not None:
            # New field starts — flush previous chunk
            _flush()
            current_type = ft
            current_chunk = [s]
        elif current_type:
            # Continuation value line (e.g. name value after "Nama" label)
            current_chunk.append(s)
        # Lines before any recognised field are discarded (page headers etc.)

    _flush()
    return dict(sections)


def segment_field_parallel(lines: List[str], num_cols: int = 3) -> List[List[str]]:
    """
    Reconstruct per-card blocks from field-parallel OCR output.

    Field-parallel means OCR emitted all EPICs first, then all names, then all
    fathers, etc.  We collect each field section as an ordered list, then zip
    by card index to build one block per card.

    Index mapping for a 3-column, 10-row page (30 cards):
      - EPICs are in reading order: card 1, 2, 3, 4, 5, … 30
      - Names are in the same reading order
      - So card k gets: epic[k], name[k], relative[k], house[k], age[k]
    """
    sections = _collect_sections(lines)
    epics = sections.get("epic", [])
    if not epics:
        return []

    num_cards = len(epics)
    names = sections.get("name", [])
    relatives = sections.get("relative", [])
    houses = sections.get("house", [])
    ages = sections.get("age_gender", [])
    availables = sections.get("available", [])
    serials = sections.get("serial", [])

    def _get(lst: List[List[str]], idx: int) -> List[str]:
        return lst[idx] if idx < len(lst) else []

    cards: List[List[str]] = []
    for k in range(num_cards):
        block: List[str] = []
        # Serial (if present, comes before EPIC in some formats)
        block.extend(_get(serials, k))
        # EPIC
        block.extend(_get(epics, k))
        # Name
        block.extend(_get(names, k))
        # Relative (Father/Husband/Mother)
        block.extend(_get(relatives, k))
        # House
        block.extend(_get(houses, k))
        # Age/Gender
        block.extend(_get(ages, k))
        # Available
        block.extend(_get(availables, k))
        if block:
            cards.append(block)

    logger.debug("segment_field_parallel: %d EPICs → %d card blocks", num_cards, len(cards))
    return cards


# ---------------------------------------------------------------------------
# Strategy 2 — Grid reorder (EPICs in rows of num_cols, field-parallel data)
# ---------------------------------------------------------------------------

def _find_epic_positions(lines: List[str]) -> List[Tuple[int, str]]:
    """Return [(line_index, epic_text), ...] for every EPIC line."""
    return [(i, lines[i].strip()) for i in range(len(lines)) if RE_EPIC.match(lines[i].strip())]


def _split_data_by_name_labels(data_lines: List[str], num_cols: int) -> List[List[str]]:
    """
    Split the field-parallel data section (lines between two EPIC rows) into
    num_cols per-card chunks using Name labels as card boundaries.
    """
    if not data_lines or num_cols < 1:
        return [[] for _ in range(num_cols)]

    def _ft(ln: str) -> Optional[str]:
        s = ln.strip()
        if RE_NAME_LABEL.match(s):
            return "name"
        if RE_FATHER_LABEL.match(s) or RE_HUSBAND_LABEL.match(s) or RE_MOTHER_LABEL.match(s):
            return "father"
        if RE_HOUSE_LABEL.match(s):
            return "house"
        if RE_AGE_LABEL.match(s):
            return "age"
        if RE_AVAIL.match(s):
            return "avail"
        return None

    # Use Name labels as primary card boundaries
    name_pos = [i for i, ln in enumerate(data_lines) if RE_NAME_LABEL.match(ln.strip())]
    if len(name_pos) >= num_cols:
        # Find where name section ends (first Father/House/Age label after last name)
        post_name_start = len(data_lines)
        for k in range(name_pos[-1] + 1, len(data_lines)):
            if _ft(data_lines[k]) in ("father", "house", "age", "avail"):
                post_name_start = k
                break

        name_chunks: List[List[str]] = []
        for j, nstart in enumerate(name_pos[:num_cols]):
            nend = name_pos[j + 1] if j + 1 < num_cols else post_name_start
            name_chunks.append(data_lines[nstart:nend])

        rest = data_lines[post_name_start:]
        rest_chunks = _split_parallel_section(rest, num_cols)
        return [name_chunks[j] + rest_chunks[j] for j in range(num_cols)]

    # Fallback: Father labels as boundaries
    father_pos = [
        i for i, ln in enumerate(data_lines)
        if RE_FATHER_LABEL.match(ln.strip()) or RE_HUSBAND_LABEL.match(ln.strip()) or RE_MOTHER_LABEL.match(ln.strip())
    ]
    if len(father_pos) >= num_cols:
        chunks: List[List[str]] = []
        for j, fstart in enumerate(father_pos[:num_cols]):
            fend = father_pos[j + 1] if j + 1 < num_cols else len(data_lines)
            chunks.append(data_lines[fstart:fend])
        return chunks

    # Last resort: equal-size split
    chunk_size = max(1, len(data_lines) // num_cols)
    return [data_lines[j * chunk_size: (j + 1) * chunk_size] for j in range(num_cols)]


def _split_parallel_section(lines: List[str], num_cols: int) -> List[List[str]]:
    """
    Split Father/House/Age/Available field-parallel lines into num_cols chunks.
    Groups consecutive field-start labels into rows of num_cols.
    """
    if not lines or num_cols < 1:
        return [[] for _ in range(num_cols)]

    chunks: List[List[str]] = [[] for _ in range(num_cols)]

    def _is_start(ln: str) -> bool:
        s = ln.strip()
        return bool(
            RE_FATHER_LABEL.match(s) or RE_HUSBAND_LABEL.match(s) or RE_MOTHER_LABEL.match(s)
            or RE_HOUSE_LABEL.match(s)
            or RE_AGE_LABEL.match(s)
            or RE_AVAIL.match(s)
        )

    field_starts = [i for i, ln in enumerate(lines) if _is_start(ln)]
    if not field_starts:
        chunk_size = max(1, len(lines) // num_cols)
        return [lines[j * chunk_size: (j + 1) * chunk_size] for j in range(num_cols)]

    i = 0
    while i < len(field_starts):
        group = field_starts[i: i + num_cols]
        i += num_cols
        for col_idx, fs in enumerate(group):
            fe = (
                group[col_idx + 1] if col_idx + 1 < len(group)
                else field_starts[i] if i < len(field_starts)
                else len(lines)
            )
            if col_idx < num_cols:
                chunks[col_idx].extend(lines[fs:fe])
    return chunks


def reorder_grid_to_cards(
    lines: List[str],
    num_cols: int,
    rows_of_cards: int = 1,
) -> List[List[str]]:
    """
    Reorder grid OCR output (EPICs in rows of num_cols, field-parallel data per row)
    into per-card blocks using Name labels as intra-row card boundaries.
    """
    total_cards = num_cols * rows_of_cards
    epic_pos = _find_epic_positions(lines)
    if len(epic_pos) < num_cols:
        return []

    epic_rows: List[List[Tuple[int, str]]] = []
    for r in range(rows_of_cards):
        start = r * num_cols
        if start < len(epic_pos):
            epic_rows.append(epic_pos[start: min(start + num_cols, len(epic_pos))])
    if not epic_rows:
        return []

    cards: List[List[str]] = []
    for row_idx, row_epics in enumerate(epic_rows):
        last_epic_idx = row_epics[-1][0]
        data_end = (
            epic_rows[row_idx + 1][0][0] if row_idx + 1 < len(epic_rows) else len(lines)
        )
        data_lines = [ln for ln in lines[last_epic_idx + 1: data_end] if ln.strip()]
        col_count = len(row_epics)

        if not data_lines:
            for epic in row_epics:
                cards.append([epic[1]])
            continue

        chunks = _split_data_by_name_labels(data_lines, col_count)
        for col_idx, epic in enumerate(row_epics):
            block = [epic[1]] + (chunks[col_idx] if col_idx < len(chunks) else [])
            cards.append(block)

    return cards[:total_cards]


# ---------------------------------------------------------------------------
# Layout detection helpers
# ---------------------------------------------------------------------------

def detect_grid_layout(lines: List[str]) -> Tuple[bool, int, int]:
    """
    Detect grid layout: EPICs appear in rows of num_cols at the start of each row.
    Returns (is_grid, num_cols, total_cards).

    Skips page header lines (non-EPIC, non-serial) to find the first consecutive
    EPIC group, which determines num_cols.
    """
    epic_pos = _find_epic_positions(lines)
    if len(epic_pos) < 2:
        return False, 0, 0
    total_cards = len(epic_pos)

    # Find the first EPIC line, then count how many consecutive EPICs follow it
    first_epic_idx = epic_pos[0][0]
    num_cols = 0
    i = first_epic_idx
    while i < len(lines) and RE_EPIC.match(lines[i].strip()):
        num_cols += 1
        i += 1

    if num_cols < 1:
        return False, 0, 0
    rows_of_cards = (total_cards + num_cols - 1) // num_cols
    return True, num_cols, min(total_cards, num_cols * rows_of_cards)


def _is_field_parallel(lines: List[str], min_epics: int = 3) -> bool:
    """
    Return True when the page is fully field-parallel: ALL EPICs appear in one
    consecutive block before any Name/Father/House labels.

    Grid-row layout has EPICs only at the start of each row; after the first
    row's EPICs a Name label appears, then more EPICs for the next row.
    We detect this by checking that the total EPICs on the page equal the
    consecutive EPICs found at the start of the voter-data section.
    """
    # Count total EPICs on the page
    total_epics = sum(1 for ln in lines if RE_EPIC.match(ln.strip()))
    if total_epics < min_epics:
        return False

    # Count consecutive EPICs after skipping page header lines
    in_epic_section = False
    consecutive_epics = 0
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if RE_EPIC.match(s):
            in_epic_section = True
            consecutive_epics += 1
        elif RE_SERIAL.match(s) and in_epic_section:
            pass  # serial interspersed with EPICs is fine
        elif not in_epic_section:
            continue  # still in page header
        else:
            break  # non-EPIC line after EPICs started → streak broken

    # Field-parallel: the opening EPIC streak equals ALL EPICs on the page
    return consecutive_epics >= min_epics and consecutive_epics == total_epics


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def segment_page_text(
    text: str,
    cards_per_row: int = 3,
    rows_per_page: int = 10,
) -> List[List[str]]:
    """
    Segment page text into one-block-per-card.

    Strategy priority:
      1. Field-parallel: all EPICs appear first → section-based reconstruction.
      2. Grid reorder: EPICs in rows of cards_per_row → row-by-row field-parallel split.
      3. EPIC-based split: sequential layout (EPIC1, fields1, EPIC2, fields2, …).
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []

    # --- Strategy 1: field-parallel (all EPICs at top) ---
    if _is_field_parallel(lines, min_epics=cards_per_row):
        cards = segment_field_parallel(lines, num_cols=cards_per_row)
        if cards and len(cards) >= cards_per_row:
            logger.debug("segment_page_text: field-parallel → %d blocks", len(cards))
            return cards

    # --- Strategy 2: grid layout (EPICs in rows) ---
    is_grid, num_cols, total_cards = detect_grid_layout(lines)
    logger.debug(
        "segment_page_text: is_grid=%s num_cols=%s total_cards=%s",
        is_grid, num_cols, total_cards,
    )
    if is_grid and num_cols >= 2 and total_cards >= 3:
        rows_of_cards = max(1, (total_cards + num_cols - 1) // num_cols)
        cards = reorder_grid_to_cards(lines, num_cols, rows_of_cards)
        logger.debug("segment_page_text: grid → %d blocks", len(cards))
        if cards and len(cards) >= 3:
            return cards

    # --- Strategy 3: EPIC-based split (sequential) ---
    result: List[List[str]] = []
    i = 0
    while i < len(lines):
        if RE_EPIC.match(lines[i]):
            block = [lines[i]]
            i += 1
            while i < len(lines) and not RE_EPIC.match(lines[i]):
                block.append(lines[i])
                i += 1
            if len(block) >= 3:
                result.append(block)
        else:
            i += 1
    logger.debug("segment_page_text: EPIC-split → %d blocks", len(result))
    return result


# ---------------------------------------------------------------------------
# Structural anomaly detection
# ---------------------------------------------------------------------------

def count_structural_anomalies(block: List[str]) -> List[str]:
    """Detect possible cross-card merge within a single block."""
    anomalies: List[str] = []
    name_count = sum(1 for ln in block if RE_NAME_LABEL.match(ln.strip()))
    age_count = sum(
        1 for ln in block
        if RE_AGE_LABEL_GLOBAL.search(ln)
        or re.match(r"^\d{1,3}\s+(?:gender|gerer|gerder)", ln.strip(), re.I)
    )
    gender_count = len(RE_GENDER_WORD.findall(" ".join(block)))
    if name_count > 1:
        anomalies.append("multiple_name_labels")
    if age_count > 2:
        anomalies.append("multiple_age_labels")
    if gender_count > 1:
        anomalies.append("multiple_gender_values")
    return anomalies


# ---------------------------------------------------------------------------
# Legacy helpers (kept for backward compatibility)
# ---------------------------------------------------------------------------

def segment_by_epic(text: str) -> List[Tuple[str, List[str]]]:
    """Split page text by EPIC positions (sequential layout)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    blocks: List[Tuple[str, List[str]]] = []
    i = 0
    while i < len(lines):
        if RE_EPIC.match(lines[i]):
            epic = lines[i]
            block: List[str] = [lines[i]]
            i += 1
            while i < len(lines) and not RE_EPIC.match(lines[i]):
                block.append(lines[i])
                i += 1
            blocks.append((epic, block))
        else:
            i += 1
    return blocks


def segment_by_epic_with_indices(lines: List[str]) -> List[Tuple[int, int, str]]:
    """Return (start_idx, end_idx, epic) for each EPIC block."""
    result: List[Tuple[int, int, str]] = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if RE_EPIC.match(s):
            start = i
            epic = s
            i += 1
            while i < len(lines) and not RE_EPIC.match(lines[i].strip()):
                i += 1
            result.append((start, i, epic))
        else:
            i += 1
    return result
