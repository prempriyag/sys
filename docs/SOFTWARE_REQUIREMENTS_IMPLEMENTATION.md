# SIR Impact Analytics Platform – SRD Implementation Status

This document maps the **Software Requirement Document** to the current implementation.

---

## 1. System Overview

| Requirement | Status | Notes |
|-------------|--------|--------|
| Automated comparison of Pre-SIR vs Post-SIR rolls | Done | Matching engine (EPIC + fuzzy Name+Relative+Door) |
| Classify changes (ADDED, DELETED, etc.) | Done | UNCHANGED, ADDED, DELETED, MODIFIED, MIGRATED |
| Booth-level KPIs | Done | Net change %, deletion velocity, youth intake %, gender shift % |
| Risk-based political insights | Done | HIGH_RISK, HIGH_OPPORTUNITY, ANOMALY, risk_score 0–100 |

---

## 2. User Roles

| Role | Access | Status |
|------|--------|--------|
| Admin | Full system access | Implemented via existing auth/roles |
| Data Analyst | Upload & process rolls | Same; upload/matching available |
| Political Analyst | View insights & reports | Dashboard, Booth Analysis, Reports |
| Field Lead | View validation list | Field Validation – sampling list + status |

Role-based visibility can be wired to existing permissions (e.g. by menu or API).

---

## 3. Functional Modules

### MODULE 1: Data Upload & Management

| Feature | Status | API / Location |
|---------|--------|----------------|
| Upload Pre-SIR Roll (PDF/CSV) | Done | POST /api/upload/pre-sir, /api/upload/pre-sir-pdf |
| Upload Post-SIR Roll (PDF/CSV) | Done | POST /api/upload/post-sir, /api/upload/post-sir-pdf |
| Upload Booth Mapping file | Done | POST /api/upload/booth-mapping (CSV: constituency, booth, location, lat, lng, turnout) |
| Upload Turnout History file | Done | POST /api/upload/turnout-history (CSV: constituency, booth, turnout_percentage) |
| Version control | Partial | DB stores current state; no multi-version UI yet |

### MODULE 2: Data Standardization Engine

| Feature | Status | Notes |
|---------|--------|--------|
| Convert text to uppercase | Done | NormalizationService |
| Remove special characters | Done | NormalizationService |
| Tamil → English transliteration | Placeholder | NormalizationService; extend with mapping if needed |
| Validate booth counts | Partial | Can be added in upload flow against ECI list |

### MODULE 3: Record Matching Engine

| Feature | Status | Notes |
|---------|--------|--------|
| Exact match (EPIC) | Done | MatchingEngine |
| Fuzzy match (Name + Relative + Door No, >90%) | Done | rapidfuzz |
| Household clustering (House No) | Done | analyze_families for anomaly (>15 per house) |
| Classifications: UNCHANGED, ADDED, DELETED, MODIFIED, MIGRATED | Done | voter_match_results (MatchResult) |

### MODULE 4: KPI & Analytics Engine

| Feature | Status | Notes |
|---------|--------|--------|
| Net Roll Change % | Done | BoothKPI |
| Deletion rate vs district | Done | deletion_velocity %; district average can be added |
| Youth Addition % | Done | youth_intake_percent |
| Gender ratio change | Done | gender_shift_percent |
| High Risk Booth | Done | risk_category + turnout & deletion logic |
| High Opportunity Booth | Done | risk_category |
| Fake cluster detection | Done | anomaly_household_count (>15 per household) |
| Risk score 0–100 | Done | BoothKPI.risk_score |

### MODULE 5: GIS Visualization Module

| Feature | Status | Notes |
|---------|--------|--------|
| Booth-level color mapping | Done | Risk Heatmap (Leaflet) |
| Deletion / Addition heatmap | Partial | Risk map uses risk_category; layers by metric can be added |
| Risk visualization layer | Done | risk_category / risk_score on map |
| GeoJSON booth boundary | Not done | Currently lat/lng points; boundaries need shapefile/GeoJSON upload |

### MODULE 6: Field Validation Module

| Feature | Status | Notes |
|---------|--------|--------|
| Auto-generate sampling list | Done | High-risk booths + 5% deleted sample (API + UI) |
| Download field verification sheet | Done | CSV download in Field Validation UI |
| Mark status: Verified Correct, False Deletion, Suspicious Addition | Done | field_validation_results table + POST /api/sir/validation/update-status |
| Sampling list with status | Done | GET /api/sir/validation/sampling-with-status/{constituency_id} |

### MODULE 7: Reporting Module

| Feature | Status | Notes |
|---------|--------|--------|
| Executive Summary | Done | Dashboard + CSV export GET /api/sir/reports/executive-summary/csv |
| Constituency Impact Sheet | Done | Dashboard + Booth KPIs |
| Booth Action Plan | Done | High-risk list + CSV export GET /api/sir/reports/booth-action-plan/csv |
| Heatmap exports | Partial | Map in UI; export as image can be added |
| Export PDF/Excel | Partial | CSV done; PDF/Excel can be added (e.g. reportlab, openpyxl) |

---

## 4. Database Structure (aligned with SRD)

| SRD table | Implementation | Notes |
|------------|----------------|-------|
| voters_pre | voters_pre_sir (VoterPre) | epic_number, name, relative_name, age, gender, house_no, address, booth_id |
| voters_post | voters_post_sir (VoterPost) | Same structure |
| voter_changes | voter_match_results (MatchResult) | pre_voter_id, post_voter_id, classification, match_score |
| booth_metrics | booth_kpis (BoothKPI) | net_change_percent, deletion_velocity, youth_intake, gender_shift, risk_score, risk_category |
| (new) field_validation_results | Done | match_result_id, status (VERIFIED_CORRECT / FALSE_DELETION / SUSPICIOUS_ADDITION) |

Additional: constituencies, booths (with latitude, longitude, turnout_percentage).

---

## 5. Technology Stack (in use)

- Backend: Python (FastAPI)
- Database: PostgreSQL
- Matching: rapidfuzz
- GIS: Leaflet.js (frontend), lat/lng in DB (GeoJSON boundaries optional)
- Frontend: React
- PDF parsing: pdfplumber

---

## 6. Gaps / Optional Next Steps

1. **Version control**: Store multiple roll versions per constituency; UI to select version.
2. **GeoJSON booth boundaries**: Upload shapefile/GeoJSON and use for polygon heatmaps.
3. **Report export**: PDF/Excel for Executive Summary and Booth Action Plan (libraries: reportlab, openpyxl).
4. **Booth count validation**: Validate booth list against ECI published list during upload.
5. **Multi-constituency batch**: Run matching/analytics for all constituencies in one action.
6. **Role-based menus**: Restrict Data Upload / Reports / Field Validation by role (Admin, Data Analyst, Political Analyst, Field Lead).

---

## 7. How to Run PDF Extraction (Your File)

From the **backend** directory:

```bash
cd d:\python\sys\backend
python scripts/extract_pdf_roll.py "C:/Users/KAS666/Downloads/2026-EROLLGEN-S22-11-SIR-DraftRoll-Revision1-ENG-20-WI_removed.pdf"
```

Optional:

- `--constituency "Your AC Name" --booth 20` if not detected from PDF
- `--output extracted.csv` to save CSV
- `--load-pre` or `--load-post` to load into the database (after DB is configured and tables exist)

---

## 8. Dummy Data

Run the seed script so that matching and KPIs are precomputed:

```bash
cd d:\python\sys\backend
python seed_sir_data.py
```

This creates:

- **Chennai Central**: 10 booths, ~100–150 voters per booth (Pre and Post with ~90% overlap, 5% new, 5% deleted); matching and KPIs run.
- **Tambaram**: 3 booths, Pre/Post with 85% unchanged, 12% new; matching and KPIs run.

Then open the Dashboard and Booth Analysis to see results.
