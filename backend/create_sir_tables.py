"""
Script to create SIR tables in the database
"""
from database.connection import engine, Base
from sqlalchemy import text
from models import sir  # Import all SIR models to register them

# Import all SIR models explicitly
from models.sir.state import State
from models.sir.district import District
from models.sir.assembly_constituency import AssemblyConstituency
from models.sir.eci_roll_selection import EciRollSelection
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from models.sir.voter import VoterPre, VoterPost
from models.sir.kpi import BoothKPI
from models.sir.match_result import MatchResult
from models.sir.field_validation import FieldValidationResult

def enable_postgis():
    """Enable PostGIS extension if available (optional; SIR tables work without it)."""
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("PostGIS extension enabled.")
        except Exception as e:
            conn.rollback()
            err = str(e).lower()
            if "not available" in err or "no such file" in err or "postgis.control" in err:
                print("PostGIS is not installed on this PostgreSQL server; skipping. SIR tables (states, districts, eci_roll_selections, etc.) do not require PostGIS.")
            else:
                print(f"PostGIS could not be enabled (optional): {e}")

def create_tables():
    """Create all SIR tables"""
    # PostGIS is optional (only some SIR features use it)
    enable_postgis()
    
    print("Creating SIR tables...")
    Base.metadata.create_all(bind=engine, tables=[
        State.__table__,
        District.__table__,
        AssemblyConstituency.__table__,
        EciRollSelection.__table__,
        Constituency.__table__,
        Booth.__table__,
        VoterPre.__table__,
        VoterPost.__table__,
        BoothKPI.__table__,
        MatchResult.__table__,
        FieldValidationResult.__table__,
    ])
    print("SIR tables created successfully!")

if __name__ == "__main__":
    create_tables()
