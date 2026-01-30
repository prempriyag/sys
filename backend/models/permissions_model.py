"""Permissions Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import logging
from datetime import datetime
from config.constants import TBL_PERMISSIONS

logger = logging.getLogger(__name__)

class PermissionsModel:
    @staticmethod
    def get_permissions_tree(db: Session) -> List[Dict[str, Any]]:
        try:
            # Get all parent permissions
            parent_query = text(f"SELECT * FROM {TBL_PERMISSIONS} WHERE TYPE = 'parent' ORDER BY PERMISSION_NAME")
            parents = db.execute(parent_query).fetchall()
            
            tree = []
            for parent in parents:
                parent_dict = dict(parent._mapping)
                # Get children for this parent (matching CI3 structure - uses 'childs' not 'children')
                # TYPE column is nvarchar, so convert parent_id to string for comparison
                parent_id = str(parent_dict.get("ID"))
                # Use CAST on parameter to ensure SQL Server treats it as string
                child_query = text(f"SELECT * FROM {TBL_PERMISSIONS} WHERE TYPE = CAST(:parent_id AS NVARCHAR(50)) ORDER BY PERMISSION_NAME")
                children = db.execute(child_query, {"parent_id": parent_id}).fetchall()
                parent_dict["childs"] = [dict(child._mapping) for child in children]  # CI3 uses 'childs'
                tree.append(parent_dict)
            
            return tree
        except Exception as e:
            logger.exception(f"Error in get_permissions_tree: {e}")
            raise

    @staticmethod
    def get_all_permissions(db: Session) -> List[Dict[str, Any]]:
        try:
            query = text(f"SELECT * FROM {TBL_PERMISSIONS} ORDER BY TYPE, PERMISSION_NAME")
            records = db.execute(query).fetchall()
            return [dict(record._mapping) for record in records]
        except Exception as e:
            logger.exception(f"Error in get_all_permissions: {e}")
            raise

    @staticmethod
    def get_permission_by_id(db: Session, permission_id: int) -> Dict[str, Any]:
        try:
            query = text(f"SELECT * FROM {TBL_PERMISSIONS} WHERE ID = :id")
            result = db.execute(query, {"id": permission_id}).fetchone()
            if result:
                return dict(result._mapping)
            return {}
        except Exception as e:
            logger.exception(f"Error in get_permission_by_id: {e}")
            raise

    @staticmethod
    def add_permission(db: Session, permission_name: str, permission_key: str, permission_type: str) -> int:
        try:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
            insert_query = text(f"""
                INSERT INTO {TBL_PERMISSIONS} (PERMISSION_NAME, PERMISSION_KEY, TYPE, CREATED_AT, UPDATED_AT)
                VALUES (:name, :key, :type, :created_at, :updated_at)
            """)
            db.execute(insert_query, {
                "name": permission_name,
                "key": permission_key,
                "type": permission_type,
                "created_at": now,
                "updated_at": now
            })
            db.commit()
            # Get the inserted ID
            id_query = text(f"SELECT ID FROM {TBL_PERMISSIONS} WHERE PERMISSION_NAME = :name AND PERMISSION_KEY = :key")
            id_result = db.execute(id_query, {"name": permission_name, "key": permission_key}).fetchone()
            return dict(id_result._mapping).get("ID") if id_result else 0
        except Exception as e:
            logger.exception(f"Error in add_permission: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_permission(db: Session, permission_id: int, permission_name: str, permission_key: str, permission_type: str) -> bool:
        try:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
            update_query = text(f"""
                UPDATE {TBL_PERMISSIONS}
                SET PERMISSION_NAME = :name, PERMISSION_KEY = :key, TYPE = :type, UPDATED_AT = :updated_at
                WHERE ID = :id
            """)
            result = db.execute(update_query, {
                "id": permission_id,
                "name": permission_name,
                "key": permission_key,
                "type": permission_type,
                "updated_at": now
            })
            db.commit()
            return result.rowcount > 0
        except Exception as e:
            logger.exception(f"Error in update_permission: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_permission(db: Session, permission_id: int) -> bool:
        try:
            delete_query = text(f"DELETE FROM {TBL_PERMISSIONS} WHERE ID = :id")
            result = db.execute(delete_query, {"id": permission_id})
            db.commit()
            return result.rowcount > 0
        except Exception as e:
            logger.exception(f"Error in delete_permission: {e}")
            db.rollback()
            raise

