import pyodbc
import urllib.parse
import time

MSSQL_HOST = r"172.16.2.34\SQL2014"
MSSQL_DB = "OSUCSCDEV"
MSSQL_USER = "DIGISCRIPT_KTECH_DEV"
MSSQL_PASS = "xNFk@q5;p/!U"
MSSQL_DRIVER = "ODBC Driver 17 for SQL Server"

def test_connection():
    print(f"Testing connection to {MSSQL_HOST}...")
    # Add LoginTimeout=5 to fail fast
    conn_str = f"DRIVER={{{MSSQL_DRIVER}}};SERVER={MSSQL_HOST};DATABASE={MSSQL_DB};UID={MSSQL_USER};PWD={{{MSSQL_PASS}}};LoginTimeout=5"
    
    start = time.time()
    try:
        cnxn = pyodbc.connect(conn_str)
        print(f"SUCCESS: Connected in {time.time() - start:.2f} seconds")
        cnxn.close()
    except Exception as e:
        print(f"FAILURE: Could not connect after {time.time() - start:.2f} seconds")
        print(f"Error: {e}")

if __name__ == "__main__":
    test_connection()
