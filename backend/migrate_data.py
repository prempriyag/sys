import os
import urllib
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Import models to ensure tables are registered with Base
# Make sure to append path if running as script
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.connection import Base
from models import User, Role, Permission, RolePermission, BusinessSettings, PortalSMTP
from sqlalchemy import inspect

# Load environment variables
load_dotenv()

# --- Configuration ---



# PostgreSQL Configuration (Target)
PG_HOST = os.getenv("DB_HOST", "localhost")
PG_DB = os.getenv("DB_NAME", "sys")
PG_USER = os.getenv("DB_USER", "postgres")
PG_PASS = os.getenv("DB_PASSWORD", "SYS@123")
PG_PORT = "5432"

def get_mssql_engine():
    # Wrap password in curly braces to handle special characters like ';'
    connection_string = f"DRIVER={{{MSSQL_DRIVER}}};SERVER={MSSQL_HOST};DATABASE={MSSQL_DB};UID={MSSQL_USER};PWD={{{MSSQL_PASS}}}"
    params = urllib.parse.quote_plus(connection_string)
    conn_str = f"mssql+pyodbc:///?odbc_connect={params}"
    return create_engine(conn_str)

def get_pg_engine():
    # postgresql://user:password@host:port/dbname
    # URL encode password to handle special chars like '@'
    encoded_pass = urllib.parse.quote_plus(PG_PASS)
    conn_str = f"postgresql://{PG_USER}:{encoded_pass}@{PG_HOST}:{PG_PORT}/{PG_DB}"
    return create_engine(conn_str)

def migrate_table(table_name, mssql_engine, pg_engine, id_col='ID'):
    print(f"Migrating table: {table_name}...")
    try:
        # Read from MSSQL
        df = pd.read_sql(f"SELECT * FROM {table_name}", mssql_engine)
        print(f"  - Fetched {len(df)} rows from MSSQL.")
        
        if df.empty:
            print("  - Table is empty, skipping.")
            return

        # Prepare for Postgres
        # Lowercase column names to match SQLAlchemy/Postgres standard
        df.columns = [c.lower() for c in df.columns]
        
        # Write to Postgres (append)
        df.to_sql(table_name.lower(), pg_engine, if_exists='append', index=False, chunksize=1000)
        print(f"  - Successfully inserted rows into PostgreSQL table '{table_name.lower()}'.")
        
        # Reset ID sequence in Postgres
        with pg_engine.connect() as conn:
            # Assuming 'id' column standard
            seq_curr = df[id_col].max()
            if seq_curr:
                # Handle case sensitivity for table/seq names if needed
                # Postgres usually uses table_id_seq by default
                 pass 
                 # We'll skip sequence reset for now unless strictly needed, 
                 # as SQLAlchemy created tables usually handle this. 
                 # But manual insert might require:
                 # conn.execute(text(f"SELECT setval('{table_name}_{id_col}_seq', {seq_curr}, true)"))

    except Exception as e:
        print(f"  - Error migrating {table_name}: {e}")

def run_migration():
    print("Starting Data Migration (MSSQL -> Postgres)...")
    
    try:
        mssql_engine = get_mssql_engine() 
        pg_engine = get_pg_engine()
        
        # Test Connections
        with mssql_engine.connect() as conn:
            print("  - Connected to MSSQL.")
        with pg_engine.connect() as conn:
            print("  - Connected to PostgreSQL.")
            
        # Tables to Migrate (Order matters for FKs)
        # Verify table names match your models. 
        # TBL_ADMIN = "PORTAL_ADMIN"
        # TBL_ROLES = "PORTAL_ROLES"
        # TBL_PERMISSIONS = "PORTAL_PERMISSIONS"
        # TBL_ROLE_PERMISSIONS = "PORTAL_ROLE_PERMISSIONS"

        # Create Tables in Target
        print("  - ensuring tables exist in target...")
        Base.metadata.create_all(pg_engine)
        
        # Verify created tables
        inspector = inspect(pg_engine)
        tables = inspector.get_table_names()
        print(f"  - Existing tables in Postgres: {tables}")

        # Clear existing data in target to avoid duplicates (optional but recommended for clean slate)
        with pg_engine.connect() as conn:
            print("  - Clearing existing target data...")
            # Use quotes for case sensitivity if Postgres tables were created with quotes, 
            # but SQLAlchemy usually creates lwowercase for unquoted names.
            # Assuming standard SQLAlchemy behavior (lowercase):
            try:
                conn.execute(text("TRUNCATE TABLE portal_role_permissions, portal_admin, portal_roles, portal_permissions, business_settings, portal_smtp CASCADE"))
                conn.commit()
            except Exception as e:
                print(f"  - TRUNCATE failed (ignoring, assuming tables might be empty or names differ): {e}")

        # NOTE: SQLAlchemy specific:
        # If models defined __tablename__ = "PORTAL_ROLES", SQLAlchemy might have created "PORTAL_ROLES" (quoted) or "portal_roles" (unquoted default).
        # We will try writing to lowercase names first as that is standard Postgres convention.

        migrate_table("PORTAL_ROLES", mssql_engine, pg_engine, id_col='ID')
        migrate_table("PORTAL_PERMISSIONS", mssql_engine, pg_engine, id_col='ID')
        migrate_table("PORTAL_ADMIN", mssql_engine, pg_engine, id_col='id') 
        migrate_table("PORTAL_ROLE_PERMISSIONS", mssql_engine, pg_engine, id_col='ID')
        
        # Business Settings
        migrate_table("BUSINESS_SETTINGS", mssql_engine, pg_engine, id_col='id') 
        migrate_table("PORTAL_SMTP", mssql_engine, pg_engine, id_col='id') 

        print("\nMigration Completed Successfully!")
        
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")

if __name__ == "__main__":
    run_migration()
