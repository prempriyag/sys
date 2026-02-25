# Table: `ocr_voter_uploads`

Used when you click **Upload to database** on the OCR PDF Detector page. Data is stored in the **sys** database.

---

## Table definition (SQL)

```sql
CREATE TABLE ocr_voter_uploads (
    id              BIGSERIAL PRIMARY KEY,
    epic_number     VARCHAR(50),
    name            TEXT,
    relative_name   TEXT,
    age             INTEGER,
    gender          VARCHAR(10),
    house_no        VARCHAR(200),
    address         TEXT,
    booth_number    VARCHAR(50),
    constituency_name VARCHAR(200),
    page_number     INTEGER,
    confidence      NUMERIC(5, 4),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE INDEX ix_ocr_voter_uploads_epic_number ON ocr_voter_uploads (epic_number);
CREATE INDEX ix_ocr_voter_uploads_id ON ocr_voter_uploads (id);
```

---

## Column summary

| Column             | Type         | Nullable | Description                    |
|--------------------|-------------|----------|--------------------------------|
| **id**             | BIGSERIAL   | No       | Primary key, auto-increment    |
| **epic_number**    | VARCHAR(50) | Yes      | Voter EPIC ID (e.g. ABC1234567)|
| **name**           | TEXT        | Yes      | Voter name                     |
| **relative_name**  | TEXT        | Yes      | Father/husband name            |
| **age**            | INTEGER     | Yes      | Age                            |
| **gender**         | VARCHAR(10) | Yes      | M / F                          |
| **house_no**       | VARCHAR(200)| Yes      | House number                   |
| **address**        | TEXT        | Yes      | Address                        |
| **booth_number**   | VARCHAR(50) | Yes      | Part/booth number              |
| **constituency_name** | VARCHAR(200) | Yes   | Assembly constituency name     |
| **page_number**    | INTEGER     | Yes      | PDF page number                |
| **confidence**     | NUMERIC(5,4)| Yes      | OCR confidence 0–1             |
| **created_at**     | TIMESTAMP   | No       | Insert time (server default)    |

---

## Sample data table

| id | epic_number | name      | relative_name | age | gender | house_no | address   | booth_number | constituency_name | page_number | confidence | created_at          |
|----|-------------|-----------|---------------|-----|--------|----------|----------|--------------|-------------------|-------------|------------|---------------------|
| 1  | ABC1234567  | RAMESH K  | MURUGAN       | 45  | M      | 12/34    | 1st St   | 20           | DR RADHAKRISHNAN NAGAR | 5  | 0.8500     | 2026-02-25 15:01:20 |
| 2  | WQD2616720  | LAKSHMI   | SURESH        | 38  | F      | 56       | 2nd St   | 20           | DR RADHAKRISHNAN NAGAR | 5  | 0.7200     | 2026-02-25 15:01:20 |
| 3  | XYZ9876543  | KUMAR P   | RAJAN         | 52  | M      | 7/8      | Main Rd  | 20           | DR RADHAKRISHNAN NAGAR | 6  | 0.9100     | 2026-02-25 15:01:20 |

---

## Backend model (Python)

- **Model:** `backend/models/sir/ocr_voter_upload.py` → class `OcrVoterUpload`
- **API:** `POST /api/v1/ocr-upload` inserts into this table.
