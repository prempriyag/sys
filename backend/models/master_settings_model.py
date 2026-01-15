"""Master Settings Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import logging
from config.constants import TBL_BUSINESS

logger = logging.getLogger(__name__)

class MasterSettingsModel:
    @staticmethod
    def get_business_settings(db: Session) -> List[Dict[str, Any]]:
        try:
            query = text(f"SELECT KEYCODE, KEYVALUE FROM {TBL_BUSINESS} WITH(NOLOCK)")
            records = db.execute(query).fetchall()
            settings = {}
            for record in records:
                record_dict = dict(record._mapping)
                settings[record_dict.get("KEYCODE", "")] = record_dict.get("KEYVALUE", "")
            return settings
        except Exception as e:
            logger.exception(f"Error in get_business_settings: {e}")
            raise

    @staticmethod
    def update_setting(db: Session, keycode: str, keyvalue: str) -> bool:
        try:
            update_query = text(f"""
                UPDATE {TBL_BUSINESS}
                SET KEYVALUE = :keyvalue
                WHERE KEYCODE = :keycode
            """)
            result = db.execute(update_query, {"keycode": keycode, "keyvalue": keyvalue})
            db.commit()
            return result.rowcount > 0
        except Exception as e:
            logger.exception(f"Error in update_setting: {e}")
            db.rollback()
            raise



