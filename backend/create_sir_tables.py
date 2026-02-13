"""
Script to create SIR tables in the database
"""
from database.connection import engine, Base
from sqlalchemy import text
from models import sir  # Import all SIR models to register them

# Import all SIR models explicitly
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from models.sir.voter import VoterPre, VoterPost
from models.sir.kpi import BoothKPI
from models.sir.match_result import MatchResult

def enable_postgis():
    """Enable PostGIS extension if not already enabled"""
    print("Enabling PostGIS extension...")
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("PostGIS extension enabled!")
        except Exception as e:
            print(f"Note: PostGIS extension may already be enabled: {e}")
            conn.rollback()

def create_tables():
    """Create all SIR tables"""
    # Enable PostGIS first (required for geometry columns)
    enable_postgis()
    
    print("Creating SIR tables...")
    Base.metadata.create_all(bind=engine, tables=[
        Constituency.__table__,
        Booth.__table__,
        VoterPre.__table__,
        VoterPost.__table__,
        BoothKPI.__table__,
        MatchResult.__table__,
    ])
    print("SIR tables created successfully!")

if __name__ == "__main__":
    create_tables()
