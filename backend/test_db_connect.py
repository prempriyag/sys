import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "postgres")

print(f"Testing connection to {DB_HOST} with user {DB_USER}...")
# print(f"Password provided: {'Yes' if DB_PASSWORD else 'No (Empty)'}")

try:
    # Try connecting to default 'postgres' db first to check credentials
    print(f"Attempting connection to 'postgres' database...")
    con = psycopg2.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname='postgres'
    )
    print("SUCCESS: Connected to 'postgres' database.")
    con.close()

    # Now try connecting to the target DB
    print(f"Attempting connection to '{DB_NAME}' database...")
    con = psycopg2.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME
    )
    print(f"SUCCESS: Connected to '{DB_NAME}' database.")
    con.close()

except psycopg2.OperationalError as e:
    print(f"FAILURE: OperationalError. Details: {e}")
except Exception as e:
    print(f"FAILURE: Could not connect. Type: {type(e).__name__}")
    print(f"Error details: {e}")
