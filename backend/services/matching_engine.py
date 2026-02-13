import rapidfuzz
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.sir.voter import VoterPre, VoterPost
from models.sir.match_result import MatchResult

from services.normalization import NormalizationService

class MatchingEngine:
    def __init__(self, db: Session):
        self.db = db

    def normalize_text(self, text: str) -> str:
        return NormalizationService.normalize_text(text)

    def calculate_fuzzy_score(self, pre: VoterPre, post: VoterPost) -> float:
        """
        Calculate fuzzy match score using Name + Relative Name + Door No
        Returns score between 0-100
        """
        # Combine name + relative_name + house_no for matching
        pre_combined = f"{pre.normalized_name or ''} {pre.relative_name or ''} {pre.house_no or ''}".strip()
        post_combined = f"{post.normalized_name or ''} {post.relative_name or ''} {post.house_no or ''}".strip()
        
        if not pre_combined or not post_combined:
            return 0.0
        
        # Use rapidfuzz for fuzzy matching
        score = rapidfuzz.fuzz.ratio(pre_combined, post_combined)
        return float(score)

    def run_matching(self, constituency_id: int):
        """
        Run matching algorithm:
        1. Exact EPIC match
        2. Fuzzy match (>90%) using Name + Relative Name + Door No
        3. Classify: UNCHANGED, ADDED, DELETED, MODIFIED, MIGRATED
        """
        from models.sir.booth import Booth
        
        # Clear previous match results for this constituency
        booths = self.db.query(Booth).filter(Booth.constituency_id == constituency_id).all()
        booth_ids = [b.id for b in booths]
        
        # Delete existing match results for these booths
        self.db.query(MatchResult).filter(
            MatchResult.pre_voter_id.in_(
                self.db.query(VoterPre.id).filter(VoterPre.booth_id.in_(booth_ids))
            )
        ).delete(synchronize_session=False)
        self.db.query(MatchResult).filter(
            MatchResult.post_voter_id.in_(
                self.db.query(VoterPost.id).filter(VoterPost.booth_id.in_(booth_ids))
            )
        ).delete(synchronize_session=False)
        self.db.commit()
        
        # 1. Fetch Pre and Post voters for the constituency
        pre_voters = self.db.query(VoterPre).join(Booth).filter(Booth.constituency_id == constituency_id).all()
        post_voters = self.db.query(VoterPost).join(Booth).filter(Booth.constituency_id == constituency_id).all()

        # Convert to dict for fast lookup by EPIC
        pre_dict = {v.epic_number: v for v in pre_voters if v.epic_number}
        post_dict = {v.epic_number: v for v in post_voters if v.epic_number}
        
        # Track matched voters to avoid duplicate matches
        matched_pre_ids = set()
        matched_post_ids = set()
        
        results = []

        # 2. Exact EPIC Match
        common_epics = set(pre_dict.keys()) & set(post_dict.keys())
        
        for epic in common_epics:
            pre = pre_dict[epic]
            post = post_dict[epic]
            
            classification = "UNCHANGED"
            # Check if booth changed -> Migrated
            if pre.booth_id != post.booth_id:
                classification = "MIGRATED"
            # Check if name/details changed -> Modified
            elif pre.normalized_name != post.normalized_name or pre.relative_name != post.relative_name:
                classification = "MODIFIED"
            
            results.append(MatchResult(
                pre_voter_id=pre.id,
                post_voter_id=post.id,
                classification=classification,
                match_score=100.0
            ))
            matched_pre_ids.add(pre.id)
            matched_post_ids.add(post.id)

        # 3. Fuzzy Matching for unmatched voters (>90% threshold)
        unmatched_pre = [v for v in pre_voters if v.id not in matched_pre_ids and v.epic_number not in post_dict]
        unmatched_post = [v for v in post_voters if v.id not in matched_post_ids and v.epic_number not in pre_dict]
        
        for pre in unmatched_pre:
            best_match = None
            best_score = 0.0
            
            for post in unmatched_post:
                if post.id in matched_post_ids:
                    continue
                    
                score = self.calculate_fuzzy_score(pre, post)
                if score > best_score and score >= 90.0:  # >90% threshold
                    best_score = score
                    best_match = post
            
            if best_match:
                # Determine classification
                classification = "MODIFIED"  # Fuzzy match implies some change
                if pre.booth_id != best_match.booth_id:
                    classification = "MIGRATED"
                
                results.append(MatchResult(
                    pre_voter_id=pre.id,
                    post_voter_id=best_match.id,
                    classification=classification,
                    match_score=best_score
                ))
                matched_pre_ids.add(pre.id)
                matched_post_ids.add(best_match.id)

        # 4. Identify Deletions (In Pre but not matched)
        for pre in pre_voters:
            if pre.id not in matched_pre_ids:
                results.append(MatchResult(
                    pre_voter_id=pre.id,
                    post_voter_id=None,
                    classification="DELETED",
                    match_score=0.0
                ))

        # 5. Identify Additions (In Post but not matched)
        for post in post_voters:
            if post.id not in matched_post_ids:
                results.append(MatchResult(
                    pre_voter_id=None,
                    post_voter_id=post.id,
                    classification="ADDED",
                    match_score=0.0
                ))

        # 6. Bulk Save Results
        if results:
            self.db.bulk_save_objects(results)
            self.db.commit()
        
        return len(results)

    def analyze_families(self, constituency_id: int):
        """
        SOP 4.1: Family Clustering
        Group voters by house_no to detect household-level shifts and anomalies.
        Returns dict: {booth_id: count_of_anomalous_households}
        """
        from models.sir.booth import Booth
        
        # Fetch all Post voters for the constituency grouped by booth and house_no
        voters = self.db.query(
            VoterPost.booth_id, 
            VoterPost.house_no, 
            func.count(VoterPost.id).label('count')
        ).join(Booth).filter(
            Booth.constituency_id == constituency_id
        ).group_by(VoterPost.booth_id, VoterPost.house_no).all()
            
        anomaly_counts = {}  # booth_id -> count of anomalous households
        
        for booth_id, house_no, count in voters:
            if count > 15:  # SOP 5.2: Anomaly Flag > 15 voters per household
                if booth_id not in anomaly_counts:
                    anomaly_counts[booth_id] = 0
                anomaly_counts[booth_id] += 1
                
        return anomaly_counts
