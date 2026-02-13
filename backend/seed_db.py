import sys
import os
# Add backend directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database.connection import SessionLocal, engine, Base
from models import User, Role
from helpers.auth_helper import hash_password
from config.constants import TBL_ADMIN, TBL_ROLES

def seed_data():
    db: Session = SessionLocal()
    try:
        # Create Tables if they don't exist (just in case)
        Base.metadata.create_all(bind=engine)
        
        # 1. Seed Role
        admin_role = db.query(Role).filter(Role.ROLE_KEY == "super_admin").first()
        if not admin_role:
            print("Creating Super Admin Role...")
            admin_role = Role(
                ROLE_NAME="Super Level Admin",
                ROLE_KEY="super_admin"
            )
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)
            print(f"Role Created: ID={admin_role.ID}")
        else:
            print(f"Super Admin Role already exists: ID={admin_role.ID}")

        # 2. Seed User
        email = "admin@ktechproducts.com"
        password = "Password@123" # Default strong password
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Creating Admin User ({email})...")
            user = User(
                name="System Admin",
                email=email,
                password=hash_password(password),
                role_id=admin_role.ID,
                status=1,
                college_perm=1,
                hs_perm=1,
                ocr_perm=1
            )
            db.add(user)
            db.commit()
            print("Admin User Created Successfully!")
            print(f"Login with: {email} / {password}")
        else:
            print("Admin User already exists.")
            # Optional: Reset password if known user exists but login fails
            # user.password = hash_password(password)
            # db.commit()
            # print(f"Password reset to: {password}")

    except Exception as e:
        print(f"Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
