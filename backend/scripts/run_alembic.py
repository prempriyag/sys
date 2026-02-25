"""
Run Alembic via Python so it works when 'alembic' is not on PATH.
Usage (from backend directory):
  python scripts/run_alembic.py upgrade head
  python scripts/run_alembic.py current
  python scripts/run_alembic.py history
"""
import os
import sys
from pathlib import Path

# Run from backend directory so alembic.ini is found
backend = Path(__file__).resolve().parent.parent
os.chdir(backend)

# Invoke Alembic CLI programmatically (avoids python -m alembic when __main__ is missing)
from alembic.config import main as alembic_main
alembic_argv = ["alembic"] + sys.argv[1:]
sys.exit(alembic_main(argv=alembic_argv))
