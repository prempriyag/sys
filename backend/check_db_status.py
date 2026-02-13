from sqlalchemy import create_engine, text
from migrate_data import get_pg_engine

def check_status():
    try:
        engine = get_pg_engine()
        with engine.connect() as conn:
            # Check SMTP
            result = conn.execute(text("SELECT count(*) FROM portal_smtp"))
            smtp_count = result.scalar()
            print(f"PORTAL_SMTP count: {smtp_count}")
            
            # Check Business Settings
            result = conn.execute(text("SELECT count(*) FROM business_settings"))
            biz_count = result.scalar()
            print(f"BUSINESS_SETTINGS count: {biz_count}")
            
            # Check Master Settings key
            result = conn.execute(text("SELECT KEYVALUE FROM business_settings WHERE KEYCODE = 'BLACK_LOGO'"))
            logo = result.scalar()
            print(f"BLACK_LOGO: {logo}")
            
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_status()
