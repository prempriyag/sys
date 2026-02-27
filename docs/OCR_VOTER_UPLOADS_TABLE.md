# Table: `ocr_voter_uploads`

Used when you click **Upload to database** on the OCR PDF Detector page. Data is stored in the **sys** database.

**Schema is optimized for ~7 lakh (700k) records:** indexes on `epic_number`, `page_number`, `quality_flag`, `constituency_name`, `created_at`; batch insert (5000 rows per commit) in `POST /api/v1/ocr-upload`.

---

## Table definition (SQL)

```sql
CREATE TABLE ocr_voter_uploads (
    id                BIGSERIAL PRIMARY KEY,
    epic_number       VARCHAR(50),
    name              TEXT,
    relative_name     TEXT,
    relation_type     VARCHAR(20),
    age               INTEGER,
    gender            VARCHAR(10),
    house_no          VARCHAR(200),
    address           TEXT,
    booth_number      VARCHAR(50),
    constituency_name VARCHAR(200),
    page_number       INTEGER,
    card_index        INTEGER,
    section_name      VARCHAR(200),
    source_block      TEXT,
    confidence        NUMERIC(5, 4),
    epic_confidence   NUMERIC(5, 4),
    quality_flag      VARCHAR(20),
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX ix_ocr_voter_uploads_epic_number ON ocr_voter_uploads (epic_number);
CREATE INDEX ix_ocr_voter_uploads_id ON ocr_voter_uploads (id);
CREATE INDEX ix_ocr_voter_uploads_constituency_name ON ocr_voter_uploads (constituency_name);
CREATE INDEX ix_ocr_voter_uploads_page_number ON ocr_voter_uploads (page_number);
CREATE INDEX ix_ocr_voter_uploads_quality_flag ON ocr_voter_uploads (quality_flag);
CREATE INDEX ix_ocr_voter_uploads_created_at ON ocr_voter_uploads (created_at);
```

---

## Column summary

| Column               | Type         | Nullable | Description                         |
|----------------------|-------------|----------|-------------------------------------|
| **id**               | BIGSERIAL   | No       | Primary key, auto-increment         |
| **epic_number**      | VARCHAR(50) | Yes      | Voter EPIC ID (e.g. WQD2616720)     |
| **name**             | TEXT        | Yes      | Voter name                          |
| **relative_name**    | TEXT        | Yes      | Father/husband/mother name           |
| **relation_type**    | VARCHAR(20) | Yes      | Father / Husband / Mother            |
| **age**              | INTEGER     | Yes      | Age                                 |
| **gender**           | VARCHAR(10) | Yes      | M / F                               |
| **house_no**         | VARCHAR(200)| Yes      | House number                        |
| **address**          | TEXT        | Yes      | Address                             |
| **booth_number**     | VARCHAR(50) | Yes      | Part/booth number                   |
| **constituency_name**| VARCHAR(200)| Yes      | Assembly constituency name          |
| **page_number**      | INTEGER     | Yes      | PDF page number                     |
| **card_index**       | INTEGER     | Yes      | 0-based card index on page          |
| **section_name**     | VARCHAR(200)| Yes      | Section name from roll              |
| **source_block**     | TEXT        | Yes      | Raw OCR block (debug)               |
| **confidence**       | NUMERIC(5,4)| Yes      | Overall confidence 0–1              |
| **epic_confidence**  | NUMERIC(5,4)| Yes      | EPIC-only confidence 0–1            |
| **quality_flag**     | VARCHAR(20) | Yes      | ok \| review                         |
| **created_at**       | TIMESTAMP   | No       | Insert time (server default)        |

---

## Sample data table

| id | epic_number | name      | relative_name | relation_type | age | gender | house_no | page_number | card_index | quality_flag | confidence | epic_confidence | created_at          |
|----|-------------|-----------|---------------|---------------|-----|--------|----------|-------------|------------|--------------|------------|------------------|---------------------|
| 1  | ABC1234567  | RAMESH K  | MURUGAN       | Father        | 45  | M      | 12/34    | 5           | 0           | ok           | 0.8500     | 0.90             | 2026-02-25 15:01:20 |
| 2  | WQD2616720  | LAKSHMI   | SURESH        | Husband       | 38  | F      | 56       | 5           | 1           | review       | 0.7200     | 0.70             | 2026-02-25 15:01:20 |
| 3  | XYZ9876543  | KUMAR P   | RAJAN         | Father        | 52  | M      | 7/8      | 6           | 0           | ok           | 0.9100     | 1.00             | 2026-02-25 15:01:20 |

---

## Backend model (Python)

- **Model:** `backend/models/sir/ocr_voter_upload.py` → class `OcrVoterUpload`
- **API:** `POST /api/v1/ocr-upload` inserts into this table.
