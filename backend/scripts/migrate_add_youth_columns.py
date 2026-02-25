"""
One-time migration: add youth_18_19_percent and youth_20_25_percent to booth_kpis.
Run from backend directory: python scripts/migrate_add_youth_columns.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine
from sqlalchemy import text


def run():
    with engine.connect() as conn:
        for col in ["youth_18_19_percent", "youth_20_25_percent"]:
            try:
                conn.execute(text(f"""
                    ALTER TABLE booth_kpis
                    ADD COLUMN IF NOT EXISTS {col} NUMERIC(5,2) DEFAULT 0
                """))
                conn.commit()
                print(f"Added {col} to booth_kpis (or already present).")
            except Exception as e:
                print(f"{col}: {e}")
                conn.rollback()


if __name__ == "__main__":
    run()
