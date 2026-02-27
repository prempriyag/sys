"""
PDF extractor using Google Cloud Document AI Form Parser.
Output format matches electoral_roll_pdf_extractor (records with epic_number, name, relative_name, etc.)
so it can feed into the same voter_data pipeline.

Setup:
  1. Google Cloud Console: enable Document AI API, create Form Parser processor.
  2. Set env: DOCUMENT_AI_PROJECT_ID, DOCUMENT_AI_LOCATION, DOCUMENT_AI_PROCESSOR_ID.
  3. Auth: GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON) or gcloud auth.

Online: single PDF from path or bytes (good for smaller runs).
Batch: GCS input/output URIs for 100k+ pages (use batch_process_documents).
"""
import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Key names Document AI might return (form parser / OCR) → our field name
KEY_TO_FIELD = {
    "name": "name",
    "voter name": "name",
    "epic": "epic_number",
    "epic no": "epic_number",
    "epic no.": "epic_number",
    "epic number": "epic_number",
    "father's name": "relative_name",
    "father name": "relative_name",
    "husband's name": "relative_name",
    "husband name": "relative_name",
    "relative name": "relative_name",
    "relation": "relation_type",
    "relation type": "relation_type",
    "age": "age",
    "gender": "gender",
    "sex": "gender",
    "house no": "house_no",
    "house no.": "house_no",
    "house number": "house_no",
    "address": "address",
    "constituency": "constituency_name",
    "constituency name": "constituency_name",
    "booth": "booth_number",
    "booth number": "booth_number",
    "part no": "booth_number",
    "part no.": "booth_number",
}


def _normalize_key(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())


def _parse_form_fields_to_records(document: Any) -> List[Dict[str, Any]]:
    """
    Parse Document AI Document into voter-like records.
    Handles document.entities (key-value) and pages[].formFields when present.
    Groups by page and logical "block" (same row) when possible; otherwise one record per entity set.
    """
    records: List[Dict[str, Any]] = []
    field_map = KEY_TO_FIELD.copy()

    def get_text(block: Any) -> str:
        if block is None:
            return ""
        if hasattr(block, "text_anchor") and block.text_anchor and block.text_anchor.content:
            return block.text_anchor.content
        if hasattr(block, "mention_text"):
            return getattr(block, "mention_text", "") or ""
        if hasattr(block, "content"):
            return str(block.content) if block.content else ""
        return str(block).strip() if block else ""

    # 1) Entities (Form Parser often returns key-value as entities)
    if hasattr(document, "entities") and document.entities:
        # Group entities by page and approximate segment (e.g. by y-position) to form one record per "card"
        page_entities: Dict[int, List[Tuple[str, str]]] = {}
        for ent in document.entities:
            page_num = 1
            if hasattr(ent, "page_anchor") and ent.page_anchor and ent.page_anchor.page_refs:
                page_num = int(ent.page_anchor.page_refs[0].page) + 1
            key = _normalize_key(getattr(ent, "type", None) or get_text(ent))
            value = get_text(ent)
            if hasattr(ent, "properties") and ent.properties:
                for prop in ent.properties:
                    pk = _normalize_key(getattr(prop, "type", None) or get_text(prop))
                    pv = get_text(prop)
                    if pk or pv:
                        key, value = pk or key, pv or value
                        break
            if not key and not value:
                continue
            if key in field_map or any(k in key for k in ("name", "epic", "father", "husband", "age", "gender", "house", "address", "constituency", "booth", "part", "relation")):
                if page_num not in page_entities:
                    page_entities[page_num] = []
                page_entities[page_num].append((key, value))

        # Build one record per page (or split by EPIC blocks if we detect multiple EPICs per page)
        for page_num in sorted(page_entities.keys()):
            pairs = page_entities[page_num]
            # If we see multiple EPIC-like values, split into one record per EPIC block
            epic_indices: List[int] = []
            for i, (k, v) in enumerate(pairs):
                if "epic" in k and v and re.match(r"[a-z]{2,3}\s*\d{6,7}", v.replace(" ", ""), re.I):
                    epic_indices.append(i)
            if not epic_indices:
                rec = _pairs_to_record(pairs, page_num)
                if rec:
                    records.append(rec)
            else:
                for start, end in zip(epic_indices, epic_indices[1:] + [len(pairs)]):
                    rec = _pairs_to_record(pairs[start:end], page_num)
                    if rec:
                        records.append(rec)

    # 2) Pages with formFields (alternative structure)
    if hasattr(document, "pages") and document.pages and not records:
        for page_idx, page in enumerate(document.pages):
            page_num = page_idx + 1
            if not hasattr(page, "form_fields") or not page.form_fields:
                continue
            pairs: List[Tuple[str, str]] = []
            for ff in page.form_fields:
                name = get_text(ff.field_name) if hasattr(ff, "field_name") else ""
                value = get_text(ff.field_value) if hasattr(ff, "field_value") else ""
                name = _normalize_key(name)
                if name or value:
                    pairs.append((name, value))
            if pairs:
                rec = _pairs_to_record(pairs, page_num)
                if rec:
                    records.append(rec)

    # 3) Fallback: use full text and try to find EPIC blocks (simple regex)
    if not records and hasattr(document, "text") and document.text:
        text = document.text
        # ECI EPIC pattern: 3 letters + 7 digits
        for page_num, block in enumerate(re.split(r"\f+", text), start=1):
            for m in re.finditer(r"\b([A-Za-z]{3})\s*(\d{6,7})\b", block):
                epic = (m.group(1) + m.group(2)).upper()
                records.append({
                    "epic_number": epic,
                    "name": None,
                    "relative_name": None,
                    "age": None,
                    "gender": None,
                    "house_no": None,
                    "address": None,
                    "booth_number": None,
                    "constituency_name": None,
                    "page_number": page_num,
                    "confidence_score": 0.5,
                })
        if records:
            logger.info("Document AI: fallback text parsing found %d EPIC(s)", len(records))

    return records


def _pairs_to_record(pairs: List[Tuple[str, str]], page_number: int) -> Optional[Dict[str, Any]]:
    out: Dict[str, Any] = {
        "epic_number": None,
        "name": None,
        "relative_name": None,
        "relation_type": None,
        "age": None,
        "gender": None,
        "house_no": None,
        "address": None,
        "booth_number": None,
        "constituency_name": None,
        "page_number": page_number,
        "confidence_score": 0.9,
    }
    for key, value in pairs:
        if not value or not isinstance(value, str):
            continue
        value = value.strip()[:500]
        key_norm = _normalize_key(key)
        if key_norm in KEY_TO_FIELD:
            field = KEY_TO_FIELD[key_norm]
            out[field] = value
        elif "name" in key_norm and "relative" not in key_norm and "father" not in key_norm and "husband" not in key_norm:
            out["name"] = value
        elif "epic" in key_norm:
            out["epic_number"] = re.sub(r"\s+", "", value).upper()[:20]
        elif "father" in key_norm or "husband" in key_norm:
            out["relative_name"] = value
            out["relation_type"] = "Father" if "father" in key_norm else "Husband"
        elif "age" in key_norm:
            try:
                out["age"] = int(re.sub(r"\D", "", value)[:3] or 0) or None
            except (ValueError, TypeError):
                out["age"] = None
    if out.get("epic_number") or out.get("name"):
        return out
    return None


def _get_client():
    from google.cloud import documentai_v1 as documentai
    return documentai.DocumentProcessorServiceClient()


def process_document_online(
    pdf_path: Optional[str] = None,
    pdf_bytes: Optional[bytes] = None,
    project_id: Optional[str] = None,
    location: Optional[str] = None,
    processor_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process a single PDF with Document AI (online / synchronous).
    Returns same shape as extract_from_pdf: { "records": [...], "metadata": { "pages_processed", "engine": "document_ai" } }.

    Provide either pdf_path or pdf_bytes. Config from env if not passed: DOCUMENT_AI_PROJECT_ID, DOCUMENT_AI_LOCATION, DOCUMENT_AI_PROCESSOR_ID.
    """
    project_id = (project_id or os.environ.get("DOCUMENT_AI_PROJECT_ID", "")).strip()
    location = (location or os.environ.get("DOCUMENT_AI_LOCATION", "us")).strip()
    processor_id = (processor_id or os.environ.get("DOCUMENT_AI_PROCESSOR_ID", "")).strip()
    if not project_id or not processor_id:
        raise ValueError(
            "Document AI config missing. Set DOCUMENT_AI_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID "
            "(and optionally DOCUMENT_AI_LOCATION, default 'us')."
        )

    if pdf_path:
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {path}")
        pdf_bytes = path.read_bytes()
    if not pdf_bytes:
        raise ValueError("Provide either pdf_path or pdf_bytes")

    client = _get_client()
    name = client.processor_path(project_id, location, processor_id)
    content_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    try:
        from google.cloud.documentai_v1.types import RawDocument
    except ImportError:
        from google.cloud.documentai_v1 import RawDocument
    raw_document = RawDocument(content=content_b64, mime_type="application/pdf")
    response = client.process_document(name=name, raw_document=raw_document)
    document = response.document
    records = _parse_form_fields_to_records(document)
    return {
        "records": records,
        "metadata": {
            "pages_processed": getattr(document, "page_count", len(records)) or 1,
            "engine": "document_ai",
        },
    }


def batch_process_documents(
    gcs_input_uri: str,
    gcs_output_uri: str,
    project_id: Optional[str] = None,
    location: Optional[str] = None,
    processor_id: Optional[str] = None,
    timeout: int = 3600,
) -> str:
    """
    Start a Document AI batch job: PDFs in GCS → JSON output in GCS.
    gcs_input_uri: e.g. "gs://your-bucket/input/" (prefix) or "gs://bucket/input/file.pdf"
    gcs_output_uri: e.g. "gs://your-bucket/output/"
    Returns operation name; call result() or check operation for completion.
    """
    from google.cloud import documentai_v1 as documentai

    project_id = (project_id or os.environ.get("DOCUMENT_AI_PROJECT_ID", "")).strip()
    location = (location or os.environ.get("DOCUMENT_AI_LOCATION", "us")).strip()
    processor_id = (processor_id or os.environ.get("DOCUMENT_AI_PROCESSOR_ID", "")).strip()
    if not project_id or not processor_id:
        raise ValueError("Set DOCUMENT_AI_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID")

    client = documentai.DocumentProcessorServiceClient()
    name = client.processor_path(project_id, location, processor_id)

    if gcs_input_uri.endswith("/"):
        gcs_documents = documentai.GcsDocuments(
            documents=[{"gcs_uri": gcs_input_uri, "mime_type": "application/pdf"}]
        )
        input_config = documentai.BatchDocumentsInputConfig(gcs_documents=gcs_documents)
    else:
        input_config = documentai.BatchDocumentsInputConfig(
            gcs_documents=documentai.GcsDocuments(
                documents=[{"gcs_uri": gcs_input_uri, "mime_type": "application/pdf"}]
            )
        )

    output_config = documentai.DocumentOutputConfig(
        gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=gcs_output_uri)
    )
    request = documentai.BatchProcessRequest(
        name=name,
        input_configs=[input_config],
        output_config=output_config,
    )
    operation = client.batch_process_documents(request)
    logger.info("Document AI batch job started: %s", operation.operation.name)
    operation.result(timeout=timeout)
    logger.info("Document AI batch job complete.")
    return operation.operation.name


def parse_batch_output_json(json_path: str) -> List[Dict[str, Any]]:
    """
    Parse a single JSON file from Document AI batch output into our record format.
    Batch output is one JSON per input file; each can contain multiple pages.
    """
    path = Path(json_path)
    if not path.exists():
        raise FileNotFoundError(json_path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Batch output wraps document in various ways; try common shapes
    document = data
    if isinstance(data, dict) and "document" in data:
        document = data["document"]
    return _parse_form_fields_to_records(document)


def extract_from_pdf_document_ai(
    pdf_path: str | Path,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    project_id: Optional[str] = None,
    location: Optional[str] = None,
    processor_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Drop-in alternative to extract_from_pdf using Document AI Form Parser.
    Same return shape: { "records": [...], "metadata": {...} }.
    Add default_constituency_name / default_booth_number to records that lack them.
    """
    result = process_document_online(
        pdf_path=str(pdf_path),
        project_id=project_id,
        location=location,
        processor_id=processor_id,
    )
    records = result.get("records") or []
    for r in records:
        if default_constituency_name and not r.get("constituency_name"):
            r["constituency_name"] = default_constituency_name
        if default_booth_number and not r.get("booth_number"):
            r["booth_number"] = default_booth_number
    result["records"] = records
    return result
