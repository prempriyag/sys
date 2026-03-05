# ECI Master Tables: State, District, Assembly Constituency

Three tables power the ECI download page dropdowns:

- **states** – State names (e.g. Tamil Nadu, Karnataka)
- **districts** – District names per state (`state_id` → states.id)
- **assembly_constituencies** – Assembly Constituency names per district (`district_id` → districts.id)

## 1. Create the tables

From the **backend** directory, use either option.

### Option A: Create SIR tables script (recommended)

```bash
cd backend
python create_sir_tables.py
```

This creates `states`, `districts`, `assembly_constituencies`, and other SIR tables.

### Option B: Alembic migration

```bash
cd backend
alembic upgrade head
```

This runs the migration `add_states_districts_assembly_constituencies` (revision `add_eci_master_tables`).

## 2. Seed sample data (optional)

To have State/District/Assembly Constituency options in the ECI dropdown immediately:

```bash
cd backend
python scripts/seed_eci_master_tables.py
```

This inserts example data:

- **States:** Tamil Nadu, Karnataka  
- **Districts (Tamil Nadu):** Chennai, Chengalpattu, Kancheepuram, Tiruvallur  
- **Districts (Karnataka):** Bengaluru Urban, Mysuru  
- **Assembly Constituencies** under Chennai and Chengalpattu (e.g. Dr.Radhakrishnan Nagar, Tambaram)

## 3. Verify

- Open the app → SIR → **Download from ECI**.
- State dropdown should list states from the DB (or ECI fallback if table is empty).
- After selecting a state, District dropdown should list districts for that state.
- After selecting a district, Assembly Constituency dropdown should list ACs for that district.

## Table definitions (reference)

Models live in `models/sir/`:

- `state.py` → table **states** (id, name, created_at)
- `district.py` → table **districts** (id, name, state_id, created_at)
- `assembly_constituency.py` → table **assembly_constituencies** (id, name, district_id, created_at)

API endpoints (used by the frontend):

- `GET /api/upload/eci-states` – list states
- `GET /api/upload/eci-districts?state=<name>` – list districts for state
- `GET /api/upload/eci-assembly-constituencies?state=<name>&district=<name>` – list ACs for state+district

---

## ECI download record: `eci_roll_selections`

When you click **Download from ECI**, the backend saves the PDF to disk and inserts a row into **eci_roll_selections** (state, year_of_revision, district, assembly_constituency, language, pdf_path).

**If data is not stored in the DB:**

1. **Check backend console** – When you trigger an ECI download, the backend logs either:
   - `Saving ECI download to eci_roll_selections: state=...` then `Updated` or `Inserted eci_roll_selections` → save succeeded.
   - `Could not save eci_roll_selections (insert/update): ...` with a full traceback → use that error to fix the cause.

2. **Table or column missing** – Run `python create_sir_tables.py` or `alembic upgrade head` from the backend directory. If the table exists but is missing `pdf_path`, run in PostgreSQL:
   ```sql
   ALTER TABLE eci_roll_selections ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(1000);
   ```
   (See `backend/scripts/sql/eci_roll_selections.sql`.)

3. **Restart backend** – After any code or DB change, restart the backend so the new code and connection are used.

4. **UI / header** – The frontend shows a toast: “Record saved to database” or “Record could not be saved”. The API sends response header `X-ECI-Record-Saved: true` or `false` (in DevTools → Network → select `eci-download` → Headers → expand **Response Headers**; for blob responses, scroll to see all headers).
