"""
One-time migration: add risk_score to booth_kpis and create field_validation_results table.
Run from backend directory: python scripts/migrate_add_risk_score_and_validation.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Add risk_score if missing
        try:
            conn.execute(text("""
                ALTER TABLE booth_kpis
                ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2) DEFAULT 0.0
            """))
            conn.commit()
            print("Added risk_score to booth_kpis (or already present).")
        except Exception as e:
            print(f"risk_score: {e}")
            conn.rollback()

        # Create field_validation_results if not exists (via Base.metadata would require model import)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS field_validation_results (
                    id BIGSERIAL PRIMARY KEY,
                    match_result_id BIGINT NOT NULL REFERENCES voter_match_results(id),
                    status VARCHAR(50) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            print("Created field_validation_results (or already present).")
        except Exception as e:
            print(f"field_validation_results: {e}")
            conn.rollback()

if __name__ == "__main__":
    run()
