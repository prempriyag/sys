import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

# Load .env explicitly
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
TARGET_DB = os.getenv("DB_NAME", "sir_voice_analysis")

def create_database():
    try:
        # Connect to default 'postgres' database
        con = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname='postgres'
        )
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        
        # Check if database exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{TARGET_DB}'")
        exists = cur.fetchone()
        
        if not exists:
            print(f"Creating database '{TARGET_DB}'...")
            cur.execute(f"CREATE DATABASE {TARGET_DB}")
            print("Database created successfully!")
        else:
            print(f"Database '{TARGET_DB}' already exists.")
            
        cur.close()
        con.close()
        
        # Now connect to the new DB and enable PostGIS
        con = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=TARGET_DB
        )
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        print("Enabling PostGIS extension...")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            print("PostGIS enabled!")
        except Exception as e:
            print(f"Error enabling PostGIS: {e}")
            
        cur.close()
        con.close()

    except Exception as e:
        print(f"Error creating database: {e}")

if __name__ == "__main__":
    create_database()
