"""
Create extract_downloads, extract_headers, extract_lines tables directly.
Use when alembic upgrade is blocked (e.g. multiple heads, duplicate column).
"""
import sys
from pathlib import Path

backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend))

from database.connection import engine, Base
from models.extract_batch import ExtractDownload, ExtractHeader, ExtractLine

if __name__ == "__main__":
    print("Creating extract_downloads, extract_headers, extract_lines...")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            ExtractDownload.__table__,
            ExtractHeader.__table__,
            ExtractLine.__table__,
        ],
    )
    print("Done.")
