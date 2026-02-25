"""
Add pdf_path column to eci_roll_selections if missing.
Run from backend directory: python scripts/add_pdf_path_column.py
Uses the app's DB connection (no psql needed).
"""
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from sqlalchemy import text
from database.connection import engine


def main():
    with engine.connect() as conn:
        # Check if column already exists
        r = conn.execute(
            text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'eci_roll_selections' AND column_name = 'pdf_path'
            """)
        )
        if r.fetchone():
            print("Column pdf_path already exists. Nothing to do.")
            return
        conn.execute(text("ALTER TABLE eci_roll_selections ADD COLUMN pdf_path VARCHAR(1000);"))
        conn.commit()
    print("Added column pdf_path to eci_roll_selections.")


if __name__ == "__main__":
    main()
