# TN ECI Electoral Roll PDF – Fields Reference

Reference of all data fields present in the sample PDF (ELECTORAL ROLL 2026 S22 Tamil Nadu) and how they are handled by the extractor.

---

## First Page (Cover)

| Field | Sample value | Extractor / metadata key | Notes |
|-------|--------------|--------------------------|--------|
| Document title | ELECTORAL ROLL 2026 S22 Tamil Nadu | — | Not stored |
| Assembly Constituency No and Name | 11- DR.RADHAKRISHNAN NAGAR (GEN) | `constituency_name` | ✓ |
| Part No. | 20 | `booth_number` | ✓ |
| Parliamentary Constituency | 2- CHENNAI NORTH (GEN) | `parliamentary_constituency` | ✓ |
| **1. Details of Revision** | | | |
| Year of Revision | 2026 | `revision_year` | ✓ |
| Qualifying Date | 01-01-2026 | `qualifying_date` | ✓ |
| Type of revision | Special Intensive Revision 2026 | `type_of_revision` | ✓ |
| Date of Publication | 19-12-2025 | `date_of_publication` | ✓ |
| Roll Identification | Basic Roll SSR, 2026 | `roll_identification` | ✓ |
| **2. Details of part and polling area** | | | |
| No. and name of sections in the part | 1-Tondiarpet Ward No 38 ... (list of 6) | `sections_in_part` (array) | ✓ |
| Main Town or Village | CHENNAI | `main_town_or_village` | ✓ |
| Ward no. | WARD NO 38 | `ward_no` | ✓ |
| Post Office | (empty) | — | Optional |
| Police Station | (empty) | — | Optional |
| Block | (empty) | — | Optional |
| Subdivision | (empty) | — | Optional |
| District | CHENNAI | `district` | ✓ |
| Pin code | (empty) | — | Optional |
| **3. Polling station details** | | | |
| No. and Name of Polling Station | 20- Chennai Primary School No. 4, ... | `polling_station` | ✓ |
| Address of Polling Station | Chennai Primary School No. 4, ... | `address_of_polling_station` | ✓ |
| Type of Polling Station | General | `type_of_polling_station` | ✓ |
| Number of Auxiliary Polling Stations | 0 | — | Optional |
| **4. NUMBER OF ELECTORS** | | | |
| Starting Serial No. | 1 | `starting_serial_no` | ✓ |
| Ending Serial No. | 651 | `ending_serial_no` | ✓ |
| Net Electors – Male | 323 | `net_electors_male` | ✓ |
| Net Electors – Female | 328 | `net_electors_female` | ✓ |
| Net Electors – Third Gender | 0 | `net_electors_third_gender` | ✓ |
| Net Electors – Total | 651 | `net_electors_total` | ✓ |
| Signature / Total Pages / Page | — | — | Not stored |

---

## Data Pages (Voter cards)

| Field | Sample | Record key | Notes |
|-------|--------|------------|--------|
| Serial No. | 1, 2, 3... | — | Used to detect card start; not stored |
| EPIC number | WQD2616720 | `epic_number` | ✓ |
| Name | mohammed ali.h | `name` | ✓ (supports "Name: xxx") |
| Father / Husband / Mother Name | Father Name: hanifa.j | `relative_name` | ✓ |
| House Number | 8/100, 46-1 | `house_no` | ✓ (supports "House Number: xxx") |
| Age | 32 | `age` | ✓ (supports "Age: 32 Gender: Male" line) |
| Gender | Male / Female | `gender` | ✓ |
| Photo Available | — | — | Not stored |
| Booth / Part | From first page | `booth_number` | ✓ |
| Constituency | From first page | `constituency_name` | ✓ |

---

## Summary Page (last)

| Field | Sample | Handled |
|-------|--------|--------|
| SUMMARY OF ELECTORS, Roll Type, Roll Identification | Mother Roll, Basic Roll SSR 2026 | Same as first page |
| NUMBER OF ELECTORS table | Male 323, Female 328, Third 0, Total 651 | Same as first page; can be used to validate extracted count |

---

## Not stored (by design)

- **Photo / Available** – not needed for matching or display.
- **Post Office, Police Station, Block, Subdivision, Pin code** – often empty; can be added to metadata if required.
- **Number of Auxiliary Polling Stations** – can be added if needed.
- **Section No and Name** on data pages – applies to the whole page; not attached per voter currently.

---

## Extractor behaviour

- **First page:** Metadata is extracted with regexes; values can be space- or colon-separated; fallbacks for “Type of revision” and “Date of Publication” when on next line.
- **Data pages:** Card-style parser detects records by “serial EPIC” or EPIC-only lines; supports “Name:”, “House Number:”, “Age: … Gender:” on same line.
- **Output:** `records[]` (voter rows) and `metadata` (all keys above). Frontend shows both in Extract PDF (Preview).
