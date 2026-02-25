"""
Seed State, District, and Assembly Constituency tables for ECI dropdowns.

Uses data/eci_states_districts.py for full state-wise district lists (e.g. all 38 Tamil Nadu districts).

Run after creating tables (create_sir_tables.py or alembic upgrade head).

Usage (from backend directory):
  python scripts/seed_eci_master_tables.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from models.sir.state import State
from models.sir.district import District
from models.sir.assembly_constituency import AssemblyConstituency
from data.eci_states_districts import STATE_DISTRICTS


def seed_eci_master():
    db = SessionLocal()
    try:
        # --- States and all districts from STATE_DISTRICTS ---
        for state_name, district_names in STATE_DISTRICTS.items():
            state = db.query(State).filter(State.name == state_name).first()
            if not state:
                state = State(name=state_name)
                db.add(state)
                db.commit()
                db.refresh(state)
                print(f"Created State: {state_name}")
            else:
                print(f"State already exists: {state_name}")

            added = 0
            for dname in district_names:
                d = db.query(District).filter(
                    District.state_id == state.id,
                    District.name == dname,
                ).first()
                if not d:
                    d = District(name=dname, state_id=state.id)
                    db.add(d)
                    db.commit()
                    db.refresh(d)
                    added += 1
            if added:
                print(f"  Added {added} districts for {state_name} (total {len(district_names)} districts)")

        # --- Assembly Constituencies (sample: Chennai and Chengalpattu, Tamil Nadu) ---
        state_tn = db.query(State).filter(State.name == "Tamil Nadu").first()
        chennai = (
            db.query(District).filter(
                District.state_id == state_tn.id,
                District.name == "Chennai",
            ).first() if state_tn else None
        )
        if chennai:
            for ac_name in [
                "1 - Thiruvottiyur",
                "2 - Dr.Radhakrishnan Nagar",
                "11 - Dr.Radhakrishnan Nagar",
                "3 - Perambur",
                "4 - Kolathur",
                "5 - Villivakkam",
            ]:
                ac = db.query(AssemblyConstituency).filter(
                    AssemblyConstituency.district_id == chennai.id,
                    AssemblyConstituency.name == ac_name,
                ).first()
                if not ac:
                    ac = AssemblyConstituency(name=ac_name, district_id=chennai.id)
                    db.add(ac)
                    db.commit()
                    db.refresh(ac)
                    print(f"    Created Assembly Constituency: {ac_name}")
                else:
                    print(f"    AC already exists: {ac_name}")

        # --- Assembly Constituencies (under Chengalpattu, Tamil Nadu) ---
        chengalpattu = (
            db.query(District).filter(
                District.state_id == state_tn.id,
                District.name == "Chengalpattu",
            ).first() if state_tn else None
        )
        if chengalpattu:
            for ac_name in ["Tambaram", "Sriperumbudur", "Kancheepuram"]:
                ac = db.query(AssemblyConstituency).filter(
                    AssemblyConstituency.district_id == chengalpattu.id,
                    AssemblyConstituency.name == ac_name,
                ).first()
                if not ac:
                    ac = AssemblyConstituency(name=ac_name, district_id=chengalpattu.id)
                    db.add(ac)
                    db.commit()
                    db.refresh(ac)
                    print(f"    Created Assembly Constituency: {ac_name}")

        print("\nECI master tables seeded. State/District/Assembly Constituency dropdowns will show data.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_eci_master()
