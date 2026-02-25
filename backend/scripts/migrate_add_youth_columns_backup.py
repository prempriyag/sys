"""One-time migration: add youth_18_19_percent and youth_20_25_percent to booth_kpis (SOP 5.1)."""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database.connection import engine

def run():
    with engine.connect() as conn:
        for col in ["youth_18_19_percent", "youth_20_25_percent"]:
            try:
                conn.execute(text(
                    f'ALTER TABLE booth_kpis ADD COLUMN IF NOT EXISTS {col} NUMERIC(5,2) DEFAULT 0'
                ))
                conn.commit()
                print(f"Added {col} to booth_kpis (or already present).")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"Column {col} already exists.")
                else:
                    print(f"Error adding {col}: {e}")

if __name__ == "__main__":
    run()
