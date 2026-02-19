"""
Script to seed dummy SIR data in PostgreSQL database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database.connection import SessionLocal, engine, Base
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from models.sir.voter import VoterPre, VoterPost
from models.sir.kpi import BoothKPI
from services.normalization import NormalizationService
import random
from datetime import datetime

def seed_sir_data():
    """Seed dummy SIR data"""
    db: Session = SessionLocal()
    try:
        print("Seeding SIR dummy data...")
        
        # 1. Create Constituency
        constituency = db.query(Constituency).filter(Constituency.name == "Chennai Central").first()
        if not constituency:
            constituency = Constituency(
                name="Chennai Central",
                district="Chennai",
                state="Tamil Nadu"
            )
            db.add(constituency)
            db.commit()
            db.refresh(constituency)
            print(f"Created Constituency: {constituency.name} (ID: {constituency.id})")
        else:
            print(f"Constituency already exists: {constituency.name} (ID: {constituency.id})")
        
        # 2. Create Booths
        booth_numbers = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110']
        booths = []
        
        for booth_num in booth_numbers:
            booth = db.query(Booth).filter(
                Booth.constituency_id == constituency.id,
                Booth.booth_number == booth_num
            ).first()
            
            if not booth:
                # Random coordinates around Chennai (12.9716, 77.5946)
                lat = 13.0827 + random.uniform(-0.1, 0.1)
                lng = 80.2707 + random.uniform(-0.1, 0.1)
                
                booth = Booth(
                    constituency_id=constituency.id,
                    booth_number=booth_num,
                    location_name=f"Booth {booth_num} - {random.choice(['Primary School', 'Community Hall', 'Temple', 'Government Office', 'School Ground'])}",
                    latitude=lat,
                    longitude=lng,
                    turnout_percentage=random.uniform(60, 80)
                )
                db.add(booth)
                db.flush()
                booths.append(booth)
                print(f"Created Booth: {booth_num} (ID: {booth.id})")
            else:
                booths.append(booth)
        
        db.commit()
        
        # 3. Create Pre-SIR Voters
        print("Creating Pre-SIR voters...")
        pre_voters = []
        names = ['Ramesh Kumar', 'Priya Devi', 'Suresh Babu', 'Lakshmi Amma', 'Rajesh Kumar', 
                 'Meera Devi', 'Karthik Raj', 'Anjali Priya', 'Mohan Das', 'Saranya Devi']
        relative_names = ['Son of', 'Daughter of', 'Wife of', 'Husband of']
        
        for booth in booths:
            # Create 100-150 voters per booth
            num_voters = random.randint(100, 150)
            for i in range(num_voters):
                name = random.choice(names) + f" {random.randint(1, 999)}"
                relative_name = f"{random.choice(relative_names)} {random.choice(names)}"
                
                address_text = f"{random.randint(1, 100)} Main Street, Area {random.randint(1, 50)}"
                voter_pre = VoterPre(
                    epic_number=f"ABC{random.randint(100000, 999999)}",
                    name=name,
                    relative_name=relative_name,
                    age=random.randint(18, 80),
                    gender=random.choice(['M', 'F']),
                    house_no=f"{random.randint(1, 500)}/{random.randint(1, 20)}",
                    address=address_text,
                    booth_id=booth.id,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text(address_text)
                )
                pre_voters.append(voter_pre)
        
        db.bulk_save_objects(pre_voters)
        db.commit()
        print(f"Created {len(pre_voters)} Pre-SIR voters")
        
        # 4. Create Post-SIR Voters (with some changes)
        print("Creating Post-SIR voters...")
        post_voters = []
        
        for booth in booths:
            # Get Pre-SIR voters for this booth
            booth_pre_voters = [v for v in pre_voters if v.booth_id == booth.id]
            num_pre = len(booth_pre_voters)
            
            # Simulate changes: 90% unchanged, 5% deleted, 5% new
            num_unchanged = int(num_pre * 0.90)
            num_new = int(num_pre * 0.05)
            
            # Add unchanged voters (slightly modified)
            for i in range(min(num_unchanged, len(booth_pre_voters))):
                pre_voter = booth_pre_voters[i]
                voter_post = VoterPost(
                    epic_number=pre_voter.epic_number,
                    name=pre_voter.name,
                    relative_name=pre_voter.relative_name,
                    age=pre_voter.age + random.choice([0, 1]),  # Age might increase by 1
                    gender=pre_voter.gender,
                    house_no=pre_voter.house_no,
                    address=pre_voter.address,
                    booth_id=booth.id,
                    normalized_name=pre_voter.normalized_name,
                    normalized_address=pre_voter.normalized_address
                )
                post_voters.append(voter_post)
            
            # Add new voters
            for i in range(num_new):
                name = random.choice(names) + f" {random.randint(1, 999)}"
                relative_name = f"{random.choice(relative_names)} {random.choice(names)}"
                
                address_text = f"{random.randint(1, 100)} Main Street, Area {random.randint(1, 50)}"
                voter_post = VoterPost(
                    epic_number=f"XYZ{random.randint(100000, 999999)}",
                    name=name,
                    relative_name=relative_name,
                    age=random.randint(18, 30),  # New voters tend to be younger
                    gender=random.choice(['M', 'F']),
                    house_no=f"{random.randint(1, 500)}/{random.randint(1, 20)}",
                    address=address_text,
                    booth_id=booth.id,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text(address_text)
                )
                post_voters.append(voter_post)
        
        db.bulk_save_objects(post_voters)
        db.commit()
        print(f"Created {len(post_voters)} Post-SIR voters")
        
        # 5. Run Matching (classify ADDED/DELETED/UNCHANGED/MODIFIED/MIGRATED)
        print("Running matching engine...")
        from services.matching_engine import MatchingEngine
        from services.kpi_engine import KPIEngine
        matching_engine = MatchingEngine(db)
        match_count = matching_engine.run_matching(constituency.id)
        print(f"Matching created {match_count} classification records")
        
        # 6. Calculate KPIs and risk scores
        print("Calculating KPIs and risk scores...")
        kpi_engine = KPIEngine(db)
        kpi_engine.calculate_booth_kpis(constituency.id)
        print("KPIs calculated successfully")
        
        # --- Second constituency: Tambaram (different risk profile) ---
        print("\nSeeding second constituency: Tambaram...")
        c2 = db.query(Constituency).filter(Constituency.name == "Tambaram").first()
        if not c2:
            c2 = Constituency(name="Tambaram", district="Chengalpattu", state="Tamil Nadu")
            db.add(c2)
            db.commit()
            db.refresh(c2)
        booths2 = []
        for bn in ['201', '202', '203']:
            b = db.query(Booth).filter(Booth.constituency_id == c2.id, Booth.booth_number == bn).first()
            if not b:
                b = Booth(
                    constituency_id=c2.id,
                    booth_number=bn,
                    location_name=f"Booth {bn} - Tambaram",
                    latitude=12.9249 + random.uniform(-0.02, 0.02),
                    longitude=80.0991 + random.uniform(-0.02, 0.02),
                    turnout_percentage=random.uniform(65, 82)
                )
                db.add(b)
                db.commit()
                db.refresh(b)
            booths2.append(b)
        pre2 = []
        for b in booths2:
            for i in range(random.randint(80, 120)):
                name = random.choice(names) + f" T{i}{random.randint(100, 999)}"
                pre2.append(VoterPre(
                    epic_number=f"TMB{random.randint(100000, 999999)}",
                    name=name,
                    relative_name=f"{random.choice(relative_names)} {random.choice(names)}",
                    age=random.randint(18, 75),
                    gender=random.choice(['M', 'F']),
                    house_no=f"{random.randint(1, 200)}",
                    address=f"Tambaram Area {random.randint(1, 30)}",
                    booth_id=b.id,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text(f"Tambaram Area {random.randint(1, 30)}")
                ))
        db.bulk_save_objects(pre2)
        db.commit()
        post2 = []
        for b in booths2:
            booth_pre = [v for v in pre2 if v.booth_id == b.id]
            for v in booth_pre[:int(len(booth_pre) * 0.85)]:  # 85% unchanged
                post2.append(VoterPost(
                    epic_number=v.epic_number,
                    name=v.name,
                    relative_name=v.relative_name,
                    age=v.age,
                    gender=v.gender,
                    house_no=v.house_no,
                    address=v.address,
                    booth_id=b.id,
                    normalized_name=v.normalized_name,
                    normalized_address=v.normalized_address
                ))
            for i in range(int(len(booth_pre) * 0.12)):  # 12% new
                name = random.choice(names) + f" New{i}"
                post2.append(VoterPost(
                    epic_number=f"TMB{random.randint(200000, 899999)}",
                    name=name,
                    relative_name=f"{random.choice(relative_names)} {random.choice(names)}",
                    age=random.randint(18, 25),
                    gender=random.choice(['M', 'F']),
                    house_no=f"{random.randint(1, 200)}",
                    address="Tambaram New Area",
                    booth_id=b.id,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text("Tambaram New Area")
                ))
        db.bulk_save_objects(post2)
        db.commit()
        matching_engine.run_matching(c2.id)
        kpi_engine.calculate_booth_kpis(c2.id)
        print(f"Tambaram: {len(pre2)} Pre-SIR, {len(post2)} Post-SIR, matching and KPIs done.")
        
        print("\nSIR dummy data seeded successfully!")
        print(f"   - Constituencies: Chennai Central, Tambaram")
        print(f"   - Chennai Central: {len(booths)} booths, {len(pre_voters)} Pre-SIR, {len(post_voters)} Post-SIR")
        print(f"   - Tambaram: {len(booths2)} booths, {len(pre2)} Pre-SIR, {len(post2)} Post-SIR")
        print("   - Matching and KPIs computed. Open Dashboard and Booth Analysis to view.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_sir_data()
