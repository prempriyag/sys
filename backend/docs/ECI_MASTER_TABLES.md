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
