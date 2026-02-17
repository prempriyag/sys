import os
from dotenv import load_dotenv

load_dotenv()

db_pass = os.getenv("DB_PASSWORD")
print(f"DB_PASSWORD present: {bool(db_pass)}")
if db_pass:
    print(f"DB_PASSWORD length: {len(db_pass)}")
    print(f"DB_PASSWORD first/last: {db_pass[0]}...{db_pass[-1]}")
else:
    print("DB_PASSWORD is empty or None")

print(f"DB_USER: {os.getenv('DB_USER')}")
print(f"DB_HOST: {os.getenv('DB_HOST')}")
