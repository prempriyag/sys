import os
import urllib
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# MSSQL Configuration (Source)
MSSQL_HOST = r"172.16.2.34\SQL2014"
MSSQL_DB = "OSUCSCDEV"
MSSQL_USER = "DIGISCRIPT_KTECH_DEV"
MSSQL_PASS = "xNFk@q5;p/!U"
MSSQL_DRIVER = "ODBC Driver 17 for SQL Server"

# PostgreSQL Configuration (Target)
PG_HOST = os.getenv("DB_HOST", "localhost")
PG_DB = os.getenv("DB_NAME", "sys")
PG_USER = os.getenv("DB_USER", "postgres")
PG_PASS = os.getenv("DB_PASSWORD", "SYS@123")
PG_PORT = "5432"

def test_mssql():
    print("Testing MSSQL Connection...")
    try:
        connection_string = f"DRIVER={{{MSSQL_DRIVER}}};SERVER={MSSQL_HOST};DATABASE={MSSQL_DB};UID={MSSQL_USER};PWD={{{MSSQL_PASS}}}"
        params = urllib.parse.quote_plus(connection_string)
        conn_str = f"mssql+pyodbc:///?odbc_connect={params}"
        engine = create_engine(conn_str)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).fetchone()
            print(f"SUCCESS MSSQL: {result[0]}")
    except Exception as e:
        print(f"FAIL MSSQL: {e}")

def test_pg():
    print("Testing Postgres Connection...")
    try:
        encoded_pass = urllib.parse.quote_plus(PG_PASS)
        conn_str = f"postgresql://{PG_USER}:{encoded_pass}@{PG_HOST}:{PG_PORT}/{PG_DB}"
        engine = create_engine(conn_str)
        with engine.connect() as conn:
             result = conn.execute(text("SELECT 1")).fetchone()
             print(f"SUCCESS PG: {result[0]}")
    except Exception as e:
        print(f"FAIL PG: {e}")

if __name__ == "__main__":
    test_mssql()
    test_pg()
