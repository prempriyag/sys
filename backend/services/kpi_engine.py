from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models.sir.booth import Booth
from models.sir.kpi import BoothKPI
from models.sir.match_result import MatchResult
from models.sir.voter import VoterPre, VoterPost
from services.matching_engine import MatchingEngine

class KPIEngine:
    def __init__(self, db: Session):
        self.db = db

    def calculate_booth_kpis(self, constituency_id: int):
        """
        Calculate all booth-level KPIs:
        - Net Roll Change %
        - Deletion Velocity
        - Youth Intake %
        - Gender Shift %
        - Anomaly household count (>15 voters)
        - Risk category
        """
        booths = self.db.query(Booth).filter(Booth.constituency_id == constituency_id).all()
        
        # Get anomaly counts from family analysis
        matching_engine = MatchingEngine(self.db)
        anomaly_counts = matching_engine.analyze_families(constituency_id)
        
        for booth in booths:
            # Basic counts
            total_pre = self.db.query(func.count(VoterPre.id)).filter(VoterPre.booth_id == booth.id).scalar() or 0
            total_post = self.db.query(func.count(VoterPost.id)).filter(VoterPost.booth_id == booth.id).scalar() or 0
            
            # Match Results Aggregations
            deletions = self.db.query(func.count(MatchResult.id))\
                .join(VoterPre, MatchResult.pre_voter_id == VoterPre.id)\
                .filter(VoterPre.booth_id == booth.id, MatchResult.classification == 'DELETED').scalar() or 0

            additions = self.db.query(func.count(MatchResult.id))\
                .join(VoterPost, MatchResult.post_voter_id == VoterPost.id)\
                .filter(VoterPost.booth_id == booth.id, MatchResult.classification == 'ADDED').scalar() or 0

            # Net Change %
            net_change = total_post - total_pre
            net_change_percent = (net_change / total_pre * 100) if total_pre > 0 else 0.0
            
            # Deletion Velocity
            deletion_velocity = (deletions / total_pre * 100) if total_pre > 0 else 0.0
            
            # Youth Intake %: Percentage of new voters (ADDED) who are age <= 30 (overall)
            youth_additions = self.db.query(func.count(VoterPost.id))\
                .join(MatchResult, VoterPost.id == MatchResult.post_voter_id)\
                .filter(
                    VoterPost.booth_id == booth.id,
                    MatchResult.classification == 'ADDED',
                    VoterPost.age <= 30
                ).scalar() or 0
            youth_intake_percent = (youth_additions / additions * 100) if additions > 0 else 0.0

            # SOP 5.1: Youth Intake in 18-19 and 20-25 age bands
            youth_18_19 = self.db.query(func.count(VoterPost.id))\
                .join(MatchResult, VoterPost.id == MatchResult.post_voter_id)\
                .filter(
                    VoterPost.booth_id == booth.id,
                    MatchResult.classification == 'ADDED',
                    VoterPost.age >= 18,
                    VoterPost.age <= 19
                ).scalar() or 0
            youth_20_25 = self.db.query(func.count(VoterPost.id))\
                .join(MatchResult, VoterPost.id == MatchResult.post_voter_id)\
                .filter(
                    VoterPost.booth_id == booth.id,
                    MatchResult.classification == 'ADDED',
                    VoterPost.age >= 20,
                    VoterPost.age <= 25
                ).scalar() or 0
            youth_18_19_percent = (youth_18_19 / additions * 100) if additions > 0 else 0.0
            youth_20_25_percent = (youth_20_25 / additions * 100) if additions > 0 else 0.0
            
            # Gender Shift %: Change in gender composition
            # Calculate pre-SIR gender distribution
            pre_male = self.db.query(func.count(VoterPre.id))\
                .filter(VoterPre.booth_id == booth.id, VoterPre.gender == 'M').scalar() or 0
            pre_female = self.db.query(func.count(VoterPre.id))\
                .filter(VoterPre.booth_id == booth.id, VoterPre.gender == 'F').scalar() or 0
            pre_total_gendered = pre_male + pre_female
            pre_male_percent = (pre_male / pre_total_gendered * 100) if pre_total_gendered > 0 else 0.0
            
            # Calculate post-SIR gender distribution
            post_male = self.db.query(func.count(VoterPost.id))\
                .filter(VoterPost.booth_id == booth.id, VoterPost.gender == 'M').scalar() or 0
            post_female = self.db.query(func.count(VoterPost.id))\
                .filter(VoterPost.booth_id == booth.id, VoterPost.gender == 'F').scalar() or 0
            post_total_gendered = post_male + post_female
            post_male_percent = (post_male / post_total_gendered * 100) if post_total_gendered > 0 else 0.0
            
            # Gender shift is the change in male percentage
            gender_shift_percent = post_male_percent - pre_male_percent
            
            # Anomaly household count (>15 voters per household)
            anomaly_household_count = anomaly_counts.get(booth.id, 0)
            
            # Risk Model
            risk = "NORMAL"
            turnout = float(booth.turnout_percentage) if booth.turnout_percentage else 0.0
            
            # High Risk: deletions >5% AND turnout >70%
            if deletion_velocity > 5.0 and turnout > 70.0:
                risk = "HIGH_RISK"
            # High Opportunity: additions >10%
            elif (additions / total_post * 100) > 10.0 if total_post > 0 else False:
                risk = "HIGH_OPPORTUNITY"
            # Anomaly: >15 voters per household detected
            if anomaly_household_count > 0:
                risk = "ANOMALY"
            
            # Update or Create KPI record
            kpi = self.db.query(BoothKPI).filter(BoothKPI.booth_id == booth.id).first()
            if not kpi:
                kpi = BoothKPI(booth_id=booth.id)
                self.db.add(kpi)
            
            kpi.total_pre = total_pre
            kpi.total_post = total_post
            kpi.additions = additions
            kpi.deletions = deletions
            kpi.net_change_percent = net_change_percent
            kpi.deletion_velocity = deletion_velocity
            kpi.youth_intake_percent = youth_intake_percent
            kpi.youth_18_19_percent = youth_18_19_percent
            kpi.youth_20_25_percent = youth_20_25_percent
            kpi.gender_shift_percent = gender_shift_percent
            kpi.anomaly_household_count = anomaly_household_count
            kpi.risk_category = risk
            
        self.db.commit()
