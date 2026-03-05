"""
AWS Textract - Electoral Roll PDF Extractor for SYS.
Integrates the OCR project logic (C:\\Users\\abcom\\Downloads\\ocr) into SIR Impact Analysis.

Supports:
  - Multi-page PDFs (50+ pages) via S3 async job
  - Key-Value pairs (forms), tables, raw text blocks
  - Voter extraction merged from tables + text (extract_voters_merged)

Output format matches electoral_roll_pdf_extractor.extract_from_pdf():
  records: [{ epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name, page_number }, ...]
  metadata: { constituency_name, booth_number, pages_processed, engine: "textract", ... }

Requirements: pip install boto3
AWS Setup: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION (or AWS_TEXTRACT_REGION), AWS_BUCKET
"""
import logging
import os
import re
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class _EpicMatch:
    """Simple wrapper so group(1) returns normalized EPIC (handles spaced formats like ABC 1234567)."""
    def __init__(self, epic: str):
        self._epic = (epic or "").strip().upper().replace(" ", "")
    def group(self, i=0):
        return self._epic if i in (0, 1) else ""


def _find_epic(text: str):
    """Return first match for EPIC in text (7-digit preferred, then 6-8 digits), or None.
    Supports spaced EPICs like 'ABC 1234567' - normalizes to ABC1234567."""
    if not (text or isinstance(text, str)):
        return None
    # Try 3 letters + 7 digits (allow optional space between)
    m = re.search(r"\b([A-Za-z]{3})\s*(\d{7})\b", text)
    if m:
        return _EpicMatch(m.group(1) + m.group(2))
    m = re.search(r"\b([A-Z]{3}\d{7})\b", text)
    if m:
        return _EpicMatch(m.group(1))
    m = re.search(r"\b([A-Za-z]{3})\s*(\d{6,8})\b", text)
    if m:
        return _EpicMatch(m.group(1) + m.group(2))
    m = re.search(r"\b([A-Z]{3}\d{6,8})\b", text)
    if m:
        return _EpicMatch(m.group(1))
    return None


def _get_textract_client(region: str):
    import boto3
    return boto3.client("textract", region_name=region)


def _get_s3_client(region: str):
    import boto3
    return boto3.client("s3", region_name=region)


def _upload_pdf_to_s3(local_path: str, bucket: str, s3_key: str, region: str) -> str:
    s3 = _get_s3_client(region)
    s3.upload_file(local_path, bucket, s3_key)
    logger.info("[Textract] Uploaded: s3://%s/%s", bucket, s3_key)
    return s3_key


def _start_textract_job(bucket: str, s3_key: str, region: str) -> str:
    client = _get_textract_client(region)
    response = client.start_document_analysis(
        DocumentLocation={"S3Object": {"Bucket": bucket, "Name": s3_key}},
        FeatureTypes=["FORMS", "TABLES"],
    )
    job_id = response["JobId"]
    logger.info("[Textract] Job started: %s", job_id)
    return job_id


def _wait_for_job(job_id: str, region: str, poll_interval: int = 5) -> str:
    client = _get_textract_client(region)
    while True:
        response = client.get_document_analysis(JobId=job_id, MaxResults=1)
        status = response["JobStatus"]
        logger.info("[Textract] Status: %s", status)
        if status in ("SUCCEEDED", "FAILED"):
            return status
        time.sleep(poll_interval)


def _fetch_all_blocks(job_id: str, region: str) -> list:
    client = _get_textract_client(region)
    blocks = []
    next_token = None
    while True:
        kwargs = {"JobId": job_id, "MaxResults": 1000}
        if next_token:
            kwargs["NextToken"] = next_token
        response = client.get_document_analysis(**kwargs)
        blocks.extend(response.get("Blocks", []))
        next_token = response.get("NextToken")
        if not next_token:
            break
    logger.info("[Textract] Total blocks fetched: %d", len(blocks))
    return blocks


def _build_block_map(blocks: list) -> dict:
    return {block["Id"]: block for block in blocks}


def _get_text(block: dict, block_map: dict) -> str:
    text_parts = []
    for rel in block.get("Relationships", []):
        if rel["Type"] == "CHILD":
            for child_id in rel["Ids"]:
                child = block_map.get(child_id, {})
                if child.get("BlockType") == "WORD":
                    text_parts.append(child.get("Text", ""))
                elif child.get("BlockType") == "SELECTION_ELEMENT":
                    text_parts.append(child.get("SelectionStatus", ""))
    return " ".join(text_parts).strip()


def _extract_key_value_pairs(blocks: list, block_map: dict) -> dict:
    kv_pairs = {}
    key_blocks = [b for b in blocks if b["BlockType"] == "KEY_VALUE_SET" and "KEY" in b.get("EntityTypes", [])]
    for key_block in key_blocks:
        key_text = _get_text(key_block, block_map)
        value_text = ""
        for rel in key_block.get("Relationships", []):
            if rel["Type"] == "VALUE":
                for val_id in rel["Ids"]:
                    val_block = block_map.get(val_id, {})
                    value_text = _get_text(val_block, block_map)
        if key_text:
            kv_pairs[key_text] = value_text
    return kv_pairs


def _extract_tables(blocks: list, block_map: dict) -> list:
    table_blocks = [b for b in blocks if b["BlockType"] == "TABLE"]
    tables = []
    for table_index, table_block in enumerate(table_blocks):
        cell_ids = []
        for rel in table_block.get("Relationships", []):
            if rel["Type"] == "CHILD":
                cell_ids.extend(rel["Ids"])
        grid = defaultdict(dict)
        for cell_id in cell_ids:
            cell = block_map.get(cell_id, {})
            if cell.get("BlockType") == "CELL":
                row, col = cell["RowIndex"], cell["ColumnIndex"]
                grid[row][col] = _get_text(cell, block_map)
        num_rows = max(grid.keys(), default=0)
        num_cols = max((max(row.keys(), default=0) for row in grid.values()), default=0)
        rows = []
        for r in range(1, num_rows + 1):
            row_data = [grid[r].get(c, "") for c in range(1, num_cols + 1)]
            rows.append(row_data)
        tables.append({
            "table_index": table_index,
            "page_number": table_block.get("Page", table_index + 1),
            "rows": rows,
        })
    return tables


def _extract_text_by_page(blocks: list) -> dict:
    pages = defaultdict(list)
    for block in blocks:
        if block["BlockType"] == "LINE":
            page = block.get("Page", 1)
            pages[page].append(block.get("Text", ""))
    return dict(sorted(pages.items()))


def _parse_block_to_details(block: str) -> dict:
    out = {"sr_no": None, "name": "", "relation": "", "relation_name": "", "house_number": "", "age": None, "gender": "", "status": ""}
    epic_match = re.search(r"\b[A-Z]{3}\d{7}\b", block) or re.search(r"\b([A-Z]{3}\d{6,8})\b", block)
    if not epic_match:
        return out
    epic_number = epic_match.group(1) if epic_match.lastindex else epic_match.group(0)
    sr_match = re.search(r"(\d+)\s+" + re.escape(epic_number), block)
    if sr_match:
        out["sr_no"] = int(sr_match.group(1))
    name_match = re.search(r"Name\s*:?\s*([A-Za-z.\s]+?)(?=\s+(Father|Husband|Mother)(\s+Name)?\s*:?|\s+House\s+Number|\s+Age|\s+Gender|\s+Name\s+[A-Za-z]|Other\s*:|$)", block, re.IGNORECASE)
    if name_match:
        out["name"] = name_match.group(1).strip()
    rel_match = re.search(r"(Father|Husband|Mother)(\s+Name)?\s*:?\s*([A-Za-z.\s]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|$)", block, re.IGNORECASE)
    if rel_match:
        out["relation"] = rel_match.group(1).capitalize()
        out["relation_name"] = rel_match.group(3).strip()
    else:
        other_match = re.search(r"Other\s*:\s*([A-Za-z\s]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|$)", block, re.IGNORECASE)
        if other_match:
            out["relation"] = "Other"
            out["relation_name"] = other_match.group(1).strip()
    house_match = re.search(r"House\s+(?:Number|No\.?)\s*:?\s*([\w\s/-]+?)(?=\s+Age\s*:?\s*\d|\s+Age\s+|\s+Gender\s|Photo|$)", block, re.IGNORECASE)
    if house_match:
        out["house_number"] = house_match.group(1).strip()
    age_match = re.search(r"Age\s*:?\s*(\d+)", block)
    if age_match:
        out["age"] = int(age_match.group(1))
    gender_match = re.search(r"\b(Male|Female)\b", block, re.IGNORECASE)
    if gender_match:
        out["gender"] = gender_match.group(1).capitalize()
    status_match = re.search(r"\b(Available|Deleted|Shifted|Dead)\b", block, re.IGNORECASE)
    out["status"] = status_match.group(1).capitalize() if status_match else "Available"
    return out


def _find_block_for_epic(page_text: str, epic_number: str) -> str:
    if not page_text or not epic_number:
        return ""
    epic_escaped = re.escape(epic_number.strip())
    blocks = re.split(r"(?=\b[A-Z]{3}\d{6,8}\b)", page_text)
    for i, block in enumerate(blocks):
        block = block.strip()
        if not block:
            continue
        if re.search(r"\b" + epic_escaped + r"\b", block):
            if not re.search(r"Name\s*:?", block, re.IGNORECASE) and i > 0:
                prev = blocks[i - 1].strip()
                if prev and re.search(r"Name\s*:?", prev, re.IGNORECASE):
                    block = prev + " " + block
            return block
    return ""


def _fill_voter_details_from_page(text_by_page: dict, epic_number: str, page_number: int) -> Optional[dict]:
    if not text_by_page or not epic_number:
        return None
    epic_number = epic_number.strip()
    last_details = None
    for try_page in (page_number, page_number - 1, page_number + 1):
        if try_page <= 0:
            continue
        page_lines = text_by_page.get(try_page, text_by_page.get(int(try_page), []))
        if not page_lines:
            continue
        page_text = "\n".join(page_lines) if isinstance(page_lines, list) else str(page_lines)
        block = _find_block_for_epic(page_text, epic_number)
        if not block:
            continue
        details = _parse_block_to_details(block)
        last_details = details
        if details.get("name") or details.get("age") is not None or details.get("gender"):
            return details
    return last_details


def _extract_all_voters(text_by_page: dict) -> list:
    all_voters = []
    for page_no, lines in text_by_page.items():
        page_text = "\n".join(lines)
        voter_blocks = re.split(r"(?=\b[A-Z]{3}\d{6,8}\b)", page_text)
        for block in voter_blocks:
            block = block.strip()
            if not block:
                continue
            epic_match = re.search(r"\b[A-Z]{3}\d{7}\b", block) or re.search(r"\b([A-Z]{3}\d{6,8})\b", block)
            if not epic_match:
                continue
            epic_number = epic_match.group(1) if epic_match.lastindex else epic_match.group(0)
            sr_match = re.search(r"(\d+)\s+" + re.escape(epic_number), block)
            sr_no = int(sr_match.group(1)) if sr_match else None
            name_match = re.search(r"Name\s*:?\s*([A-Za-z\s]+?)(?=\s+(Father|Husband|Mother)\s+Name|\s+House\s+Number|\s+Age|\s+Gender|$)", block, re.IGNORECASE)
            name = name_match.group(1).strip() if name_match else ""
            relation_match = re.search(r"(Father|Husband|Mother)\s+Name\s*:?\s*([A-Za-z\s]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|$)", block, re.IGNORECASE)
            if relation_match:
                relation, relation_name = relation_match.group(1).capitalize(), relation_match.group(2).strip()
            else:
                other_match = re.search(r"Other\s*:\s*([A-Za-z\s]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|$)", block, re.IGNORECASE)
                relation = "Other" if other_match else ""
                relation_name = other_match.group(1).strip() if other_match else ""
            house_match = re.search(r"House\s+Number\s*:\s*([\w/-]+)", block, re.IGNORECASE)
            house_number = house_match.group(1).strip() if house_match else ""
            age_match = re.search(r"Age\s*:\s*(\d+)", block)
            age = int(age_match.group(1)) if age_match else None
            gender_match = re.search(r"\b(Male|Female)\b", block, re.IGNORECASE)
            gender = gender_match.group(1).capitalize() if gender_match else ""
            status_match = re.search(r"\b(Available|Deleted|Shifted|Dead)\b", block, re.IGNORECASE)
            status = status_match.group(1).capitalize() if status_match else "Available"
            all_voters.append({
                "page_number": page_no, "sr_no": sr_no, "epic_number": epic_number,
                "name": name, "relation": relation, "relation_name": relation_name,
                "house_number": house_number, "age": age, "gender": gender, "status": status,
            })
    return all_voters


def _parse_combined_voter(combined: str, serial_cell: str, page_number: int, auto_id: int) -> Optional[dict]:
    status_match = re.search(r"\b(Available|Deleted|Shifted|Dead)\b", combined, re.IGNORECASE)
    status = status_match.group(1).capitalize() if status_match else "Available"
    combined = combined.replace("Photo Available", "").replace("Photo", "")
    combined = re.sub(r"\s+", " ", combined).strip()
    if not combined:
        return None
    epic_match = _find_epic(combined)
    if not epic_match:
        return None
    epic_number = epic_match.group(1)
    sr_no = None
    serial_cell_clean = re.sub(r"^#\s*", "", str(serial_cell).strip())
    if re.match(r"^\d+\s*$", serial_cell_clean) or re.match(r"^\d+\s+[A-Z]{3}\d{6,8}", serial_cell_clean):
        sr_match = re.match(r"^#?\s*(\d+)\s*(?:\s+[A-Z]{3}\d{6,8})?\s*$", serial_cell)
        if sr_match:
            sr_no = int(sr_match.group(1))
    if sr_no is None:
        sr_match = re.search(r"#?\s*(\d+)\s", combined)
        if sr_match:
            sr_no = int(sr_match.group(1))
    name_match = re.search(r"Name\s*:?\s*(.+?)(?=\s+(Father|Husband|Mother)(\s+Name)?\s*:?|\s+Other\s*:|\s+House\s+Number|\s+Age|\s+Gender|$)", combined, re.IGNORECASE)
    name = name_match.group(1).strip() if name_match else ""
    relation_match = re.search(r"(Father|Husband|Mother)(\s+Name)?\s*:?\s*([A-Za-z.\s\-]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|\s+-\s+Other|$)", combined, re.IGNORECASE)
    if relation_match:
        relation, relation_name = relation_match.group(1).capitalize(), relation_match.group(3).strip()
    else:
        other_match = re.search(r"Other\s*:\s*([A-Za-z.\s\-]+?)(?=\s+House\s+Number|\s+Age|\s+Gender|$)", combined, re.IGNORECASE)
        relation = "Other" if other_match else ""
        relation_name = other_match.group(1).strip() if other_match else ""
    house_match = re.search(r"House\s+(?:Number|No\.?)\s*:?\s*([\w\s/.\-]+?)(?=\s+Age\s*:?\s*\d|\s+Age\s+|\s+Gender\s|Photo|$)", combined, re.IGNORECASE)
    house_number = house_match.group(1).strip() if house_match else ""
    if house_number and (re.match(r"^Age\s*\d*", house_number, re.IGNORECASE) or house_number.lower() == "age"):
        house_number = ""
    age_match = re.search(r"Age\s*:?\s*(\d+)", combined)
    age = int(age_match.group(1)) if age_match else None
    gender_match = re.search(r"\b(Male|Female)\b", combined, re.IGNORECASE)
    gender = gender_match.group(1).capitalize() if gender_match else ""
    return {
        "id": auto_id, "page_number": page_number, "sr_no": sr_no, "epic_number": epic_number,
        "name": name, "relation": relation, "relation_name": relation_name,
        "house_number": house_number, "age": age, "gender": gender, "status": status,
    }


def _extract_voters_from_tables(tables: list) -> list:
    voters = []
    auto_id = 1
    for table in tables:
        page_number = table.get("page_number") or (table.get("table_index", 0) + 1)
        rows = table.get("rows", [])
        i = 0
        while i < len(rows):
            row = rows[i]
            if not row:
                i += 1
                continue
            first_cell = str(row[0]).strip() if len(row) > 0 else ""
            next_row = rows[i + 1] if i + 1 < len(rows) else []
            next_first = str(next_row[0]).strip() if next_row and len(next_row) > 0 else ""
            first_cell_nohash = re.sub(r"^#\s*", "", first_cell)
            first_has_epic_only = bool(re.match(r"^#?\s*\d+\s+[A-Z]{3}\d{6,8}\s*$", first_cell))
            first_is_digit_only = bool(re.match(r"^#?\s*\d+\s*$", first_cell))
            first_is_epic_only = bool(re.match(r"^[A-Z]{3}\d{6,8}\s*$", first_cell_nohash.strip()))
            first_has_details = "Name" in first_cell or "Age" in first_cell or "Gender" in first_cell
            is_serial_row = (first_has_epic_only or first_is_digit_only or first_is_epic_only) and not first_has_details
            if not is_serial_row and not first_has_details and next_row and len(next_row) > 0:
                if "Name" in next_first or "House" in next_first or "Age" in next_first or "Gender" in next_first or "Photo" in next_first:
                    is_serial_row = True
            next_has_details = "Name" in next_first or "House" in next_first or "Photo" in next_first or "Age" in next_first or "Gender" in next_first

            if is_serial_row and next_has_details and next_row is not None:
                serial_row, detail_row = row, next_row
                continuation_row = None
                row_after = rows[i + 2] if i + 2 < len(rows) else []
                if row_after:
                    row_after_first = str(row_after[0]).strip() if row_after and len(row_after) > 0 else ""
                    if ("Age" in row_after_first or "Gender" in row_after_first) and not _find_epic(row_after_first):
                        continuation_row = row_after
                max_cols = max(len(serial_row), len(detail_row), len(continuation_row) if continuation_row else 0)
                for col in range(max_cols):
                    serial_cell = str(serial_row[col]).strip() if col < len(serial_row) else ""
                    detail_cell = str(detail_row[col]).strip() if col < len(detail_row) else ""
                    cont_cell = str(continuation_row[col]).strip() if continuation_row and col < len(continuation_row) else ""
                    detail_lower = detail_cell.lower()
                    if not serial_cell and not detail_cell:
                        continue
                    if not serial_cell and detail_lower in ("photo available", "photo"):
                        continue
                    combined = f"{serial_cell} {detail_cell} {cont_cell}".strip()
                    epic_in_combined = _find_epic(combined)
                    if not epic_in_combined and serial_cell and detail_lower in ("photo available", "photo"):
                        epic_in_serial = _find_epic(serial_cell)
                        if epic_in_serial:
                            combined = f"{serial_cell} Available".strip()
                            epic_in_combined = epic_in_serial
                    if epic_in_combined:
                        v = _parse_combined_voter(combined, serial_cell, page_number, auto_id)
                        if v:
                            voters.append(v)
                            auto_id += 1
                    else:
                        if not ("Name" in detail_cell or "Age" in detail_cell or "Gender" in detail_cell or "House" in detail_cell):
                            continue
                        epic_from_next = None
                        if col + 1 < len(serial_row):
                            m = _find_epic(str(serial_row[col + 1]).strip())
                            if m:
                                epic_from_next = m.group(1)
                        if not epic_from_next and col >= 1:
                            m = _find_epic(str(serial_row[col - 1]).strip())
                            if m:
                                epic_from_next = m.group(1)
                        if epic_from_next:
                            combined_new = f"{serial_cell} {epic_from_next} {detail_cell} {cont_cell}".strip()
                            v = _parse_combined_voter(combined_new, serial_cell, page_number, auto_id)
                            if v:
                                voters.append(v)
                                auto_id += 1
                i += 3 if continuation_row else 2
                continue

            consumed_cols = set()
            for col in range(len(row)):
                if col in consumed_cols:
                    continue
                cell = str(row[col]).strip() if col < len(row) else ""
                if not cell or cell.lower() in ("photo available", "photo"):
                    continue
                cell_clean = cell.replace("Photo Available", "").replace("Photo", "").strip()
                has_details = bool(re.search(r"Name|Age|Gender|House", cell_clean, re.IGNORECASE))
                epic_in_cell = _find_epic(cell)
                if epic_in_cell and has_details:
                    v = _parse_combined_voter(cell, cell, page_number, auto_id)
                    if v:
                        voters.append(v)
                        auto_id += 1
                elif epic_in_cell and not has_details:
                    prev_cell = str(row[col - 1]).strip() if col >= 1 else ""
                    next_cell = str(row[col + 1]).strip() if col + 1 < len(row) else ""
                    prev_has_details = bool(prev_cell and re.search(r"Name|Age|Gender|House", prev_cell, re.IGNORECASE))
                    next_has_details = bool(next_cell and re.search(r"Name|Age|Gender|House", next_cell, re.IGNORECASE))
                    if prev_has_details and not consumed_cols.intersection({col - 1}):
                        combined_new = f"{prev_cell} {cell}".strip()
                        v = _parse_combined_voter(combined_new, prev_cell, page_number, auto_id)
                        if v:
                            voters.append(v)
                            auto_id += 1
                            consumed_cols.add(col - 1)
                    elif next_has_details and not consumed_cols.intersection({col + 1}):
                        combined_new = f"{cell} {next_cell}".strip()
                        v = _parse_combined_voter(combined_new, next_cell, page_number, auto_id)
                        if v:
                            voters.append(v)
                            auto_id += 1
                            consumed_cols.add(col + 1)
                    else:
                        v = _parse_combined_voter(cell, cell, page_number, auto_id)
                        if v:
                            voters.append(v)
                            auto_id += 1
                elif not epic_in_cell and has_details:
                    next_cell = str(row[col + 1]).strip() if col + 1 < len(row) else ""
                    epic_in_next = _find_epic(next_cell)
                    if epic_in_next:
                        combined_new = f"{cell} {epic_in_next.group(1)}".strip()
                        v = _parse_combined_voter(combined_new, cell, page_number, auto_id)
                        if v:
                            voters.append(v)
                            auto_id += 1
                            consumed_cols.add(col + 1)
                    else:
                        prev_cell = str(row[col - 1]).strip() if col >= 1 else ""
                        epic_in_prev = _find_epic(prev_cell)
                        if epic_in_prev:
                            combined_new = f"{cell} {epic_in_prev.group(1)}".strip()
                            v = _parse_combined_voter(combined_new, cell, page_number, auto_id)
                            if v:
                                voters.append(v)
                                auto_id += 1
                        else:
                            cell_plus2 = str(row[col + 2]).strip() if col + 2 < len(row) else ""
                            epic_in_plus2 = _find_epic(cell_plus2)
                            if epic_in_plus2:
                                combined_new = f"{cell} {epic_in_plus2.group(1)}".strip()
                                v = _parse_combined_voter(combined_new, cell, page_number, auto_id)
                                if v:
                                    voters.append(v)
                                    auto_id += 1
            i += 1
    return voters


def _sweep_missed_epics_from_tables(tables: list, seen_epics: set) -> list:
    """Fallback: sweep all table cells for EPICs not yet in seen_epics. Returns additional minimal records."""
    additional = []
    auto_id = 999000  # offset to avoid collision with main extraction ids
    for table in tables:
        page_number = table.get("page_number") or (table.get("table_index", 0) + 1)
        for row in table.get("rows", []):
            for cell in row:
                cell_str = str(cell).strip() if cell else ""
                if not cell_str or cell_str.lower() in ("photo available", "photo"):
                    continue
                epic_match = _find_epic(cell_str)
                if not epic_match:
                    continue
                epic = (epic_match.group(1) or "").strip().upper().replace(" ", "")
                if len(epic) < 9 or len(epic) > 11:  # valid EPIC is 3 letters + 6-8 digits
                    continue
                if not epic or epic in seen_epics:
                    continue
                seen_epics.add(epic)
                v = _parse_combined_voter(cell_str, cell_str, page_number, auto_id)
                if v:
                    additional.append(v)
                    auto_id += 1
    return additional


def _extract_voters_merged(tables: list, text_by_page: dict) -> list:
    table_voters = _extract_voters_from_tables(tables)

    def _norm(e):
        return (e or "").strip().upper().replace(" ", "")

    # Fallback: sweep all cells for any EPIC we might have missed (non-standard layouts)
    seen_for_sweep = {_norm(v.get("epic_number", "")) for v in table_voters if _norm(v.get("epic_number", ""))}
    sweep_voters = _sweep_missed_epics_from_tables(tables, seen_for_sweep)
    if sweep_voters:
        logger.info("[Textract] Fallback sweep found %d additional voter(s) from non-standard table layout", len(sweep_voters))
    table_voters.extend(sweep_voters)

    raw_voters = _extract_all_voters(text_by_page) if text_by_page else []
    seen_epics = set()
    merged = []
    for v in table_voters:
        epic = _norm(v.get("epic_number", ""))
        if not epic or epic in seen_epics:
            continue
        seen_epics.add(epic)
        merged.append(v)

    for idx, v in enumerate(merged, start=1):
        v["id"] = idx
    next_id = len(merged) + 1

    for v in raw_voters:
        epic = _norm(v.get("epic_number", ""))
        if not epic or epic in seen_epics:
            continue
        seen_epics.add(epic)
        merged.append({
            "id": next_id, "page_number": v.get("page_number", 0), "sr_no": v.get("sr_no"),
            "epic_number": (v.get("epic_number", "") or "").strip(), "name": v.get("name", ""),
            "relation": v.get("relation", ""), "relation_name": v.get("relation_name", ""),
            "house_number": v.get("house_number", ""), "age": v.get("age"),
            "gender": v.get("gender", ""), "status": v.get("status", ""),
        })
        next_id += 1

    if text_by_page:
        for v in merged:
            epic = v.get("epic_number", "")
            has_details = v.get("name") or v.get("age") is not None or v.get("gender") or v.get("house_number") or v.get("relation") or v.get("relation_name")
            if not epic or has_details:
                continue
            details = _fill_voter_details_from_page(text_by_page, epic, v.get("page_number", 0))
            if not details:
                continue
            for key in ("sr_no", "name", "relation", "relation_name", "house_number", "age", "gender", "status"):
                val = details.get(key)
                if val is not None and val != "" and (v.get(key) is None or v.get(key) == ""):
                    v[key] = val

    return merged


def _textract_voter_to_sys_record(v: dict, default_booth: str, default_constituency: str) -> dict:
    """Convert Textract voter dict to SYS extract_from_pdf record format.
    relation_type: Father | Husband | Mother | Other (stored separately).
    relative_name: Just the name (e.g. Kaliyaperumal), not 'Father Kaliyaperumal'.
    """
    rel = (v.get("relation") or "").strip()
    rel_name = (v.get("relation_name") or "").strip()
    relation_type = rel[:20] if rel else None  # Father, Husband, Mother, Other
    relative_name = rel_name or ""  # Store only the name
    return {
        "epic_number": (v.get("epic_number") or "").strip(),
        "name": (v.get("name") or "").strip(),
        "relative_name": relative_name or None,
        "relation_type": relation_type or None,
        "age": v.get("age"),
        "gender": v.get("gender", "").strip() or None,
        "house_no": (v.get("house_number") or "").strip(),
        "address": "",
        "booth_number": default_booth,
        "constituency_name": default_constituency,
        "page_number": v.get("page_number"),
    }


def extract_from_pdf_textract(
    pdf_path: str | Path,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    bucket: Optional[str] = None,
    s3_prefix: Optional[str] = None,
    region: Optional[str] = None,
    include_raw_tables: bool = True,
) -> Dict[str, Any]:
    """
    Extract voter records from electoral roll PDF using AWS Textract.
    Returns same format as electoral_roll_pdf_extractor.extract_from_pdf().

    Args:
        pdf_path: Local path to PDF file.
        default_constituency_name: Override constituency if not found in PDF.
        default_booth_number: Override booth/part number if not found in PDF.
        bucket: S3 bucket (default: AWS_BUCKET env).
        s3_prefix: S3 key prefix (default: pdf/uploads/).
        region: AWS region (default: AWS_TEXTRACT_REGION or AWS_DEFAULT_REGION or ap-south-1).

    Returns:
        { "records": [...], "metadata": { ... } }
    """
    import boto3  # noqa: F401

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    bucket = bucket or os.getenv("AWS_BUCKET", "").strip()
    region = region or os.getenv("AWS_TEXTRACT_REGION") or os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
    s3_prefix = (s3_prefix or os.getenv("AWS_S3_PREFIX", "pdf/uploads/")).rstrip("/") + "/"

    if not bucket:
        raise ValueError("AWS_BUCKET is required for Textract. Set it in .env or pass bucket=.")

    safe_name = pdf_path.name
    s3_key = f"{s3_prefix}{uuid.uuid4().hex[:12]}_{safe_name}"

    _upload_pdf_to_s3(str(pdf_path), bucket, s3_key, region)
    job_id = _start_textract_job(bucket, s3_key, region)
    status = _wait_for_job(job_id, region)

    if status != "SUCCEEDED":
        raise RuntimeError(f"Textract job failed for s3://{bucket}/{s3_key}")

    blocks = _fetch_all_blocks(job_id, region)
    block_map = _build_block_map(blocks)
    tables = _extract_tables(blocks, block_map)
    text_by_page = _extract_text_by_page(blocks)
    kv_pairs = _extract_key_value_pairs(blocks, block_map)

    voters = _extract_voters_merged(tables, text_by_page)

    booth = default_booth_number or ""
    constituency = default_constituency_name or ""

    for k, v in kv_pairs.items():
        if not v or not isinstance(v, str):
            continue
        v = v.strip()
        k_lower = k.lower().strip()
        if "constituency" in k_lower and v and not constituency:
            constituency = v
        elif ("part" in k_lower and "no" in k_lower) and v and not booth:
            booth = v

    assembly = (
        kv_pairs.get("No. Name and Reservation Status of Assembly Constituency :")
        or kv_pairs.get("Assembly Constituency No and Name :")
        or kv_pairs.get("Assembly Constituency No and Name")
        or ""
    )
    if isinstance(assembly, str) and assembly.strip() and not constituency:
        constituency = assembly.strip()
    year = (kv_pairs.get("Year of Revision") or kv_pairs.get("Year") or "").strip()

    records = [
        _textract_voter_to_sys_record(v, booth, constituency)
        for v in voters
    ]

    page_blocks = [b for b in blocks if b["BlockType"] == "PAGE"]
    total_pages = len(page_blocks)

    metadata: Dict[str, Any] = {
        "constituency_name": constituency,
        "booth_number": booth,
        "part_name": booth,
        "pages_processed": total_pages,
        "engine": "textract",
        "total_blocks": len(blocks),
        "total_pages": total_pages,
        "year": year or None,
    }
    if include_raw_tables and tables:
        metadata["raw_tables"] = tables

    logger.info(
        "[Textract] Done: %d voters, %d pages",
        len(records),
        total_pages,
    )

    return {"records": records, "metadata": metadata}
