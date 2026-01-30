"""Roles Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import logging
from datetime import datetime
from config.constants import TBL_ROLES, TBL_ROLE_PERMISSIONS, TBL_PERMISSIONS

logger = logging.getLogger(__name__)

class RolesModel:
    @staticmethod
    def get_roles_list(db: Session) -> List[Dict[str, Any]]:
        try:
            query = text(f"SELECT * FROM {TBL_ROLES} ORDER BY ROLE_NAME")
            records = db.execute(query).fetchall()
            return [dict(record._mapping) for record in records]
        except Exception as e:
            logger.exception(f"Error in get_roles_list: {e}")
            raise

    @staticmethod
    def get_role_by_id(db: Session, role_id: int) -> Dict[str, Any]:
        try:
            query = text(f"SELECT * FROM {TBL_ROLES} WHERE ID = :id")
            result = db.execute(query, {"id": role_id}).fetchone()
            if result:
                return dict(result._mapping)
            return {}
        except Exception as e:
            logger.exception(f"Error in get_role_by_id: {e}")
            raise

    @staticmethod
    def get_role_permissions(db: Session, role_id: int) -> List[Dict[str, Any]]:
        try:
            query = text(f"""
                SELECT rp.*, p.PERMISSION_NAME, p.PERMISSION_KEY
                FROM {TBL_ROLE_PERMISSIONS} rp
                INNER JOIN {TBL_PERMISSIONS} p ON rp.PERMISSION_ID = p.ID
                WHERE rp.ROLE_ID = :role_id
            """)
            records = db.execute(query, {"role_id": role_id}).fetchall()
            return [dict(record._mapping) for record in records]
        except Exception as e:
            logger.exception(f"Error in get_role_permissions: {e}")
            raise

    @staticmethod
    def add_role(db: Session, role_name: str, role_key: str, permissions: List[Dict[str, Any]]) -> int:
        try:
            # Insert role
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
            insert_query = text(f"""
                INSERT INTO {TBL_ROLES} (ROLE_NAME, ROLE_KEY, CREATED_AT, UPDATED_AT)
                VALUES (:name, :key, :created_at, :updated_at)
            """)
            db.execute(insert_query, {"name": role_name, "key": role_key, "created_at": now, "updated_at": now})
            db.commit()
            
            # Get the inserted role ID
            id_query = text(f"SELECT ID FROM {TBL_ROLES} WHERE ROLE_NAME = :name AND ROLE_KEY = :key")
            id_result = db.execute(id_query, {"name": role_name, "key": role_key}).fetchone()
            role_id = dict(id_result._mapping).get("ID") if id_result else 0
            
            # Get all permissions (like CI3 does)
            all_perms_query = text(f"SELECT ID FROM {TBL_PERMISSIONS}")
            all_perms = db.execute(all_perms_query).fetchall()
            
            # Create a map of permission IDs from the permissions list
            perm_map = {p.get("permission_id"): p for p in permissions}
            
            # Insert role permissions for all permissions (matching CI3 logic)
            if role_id > 0:
                for perm_row in all_perms:
                    perm_id = dict(perm_row._mapping).get("ID")
                    perm_data = perm_map.get(perm_id, {})
                    # Only insert if permission is in the list (has at least one action)
                    if perm_id in perm_map:
                        perm_insert = text(f"""
                            INSERT INTO {TBL_ROLE_PERMISSIONS} (ROLE_ID, PERMISSION_ID, ADD, VIEW, UPDATE, DELETE)
                            VALUES (:role_id, :permission_id, :add, :view, :update, :delete)
                        """)
                        db.execute(perm_insert, {
                            "role_id": role_id,
                            "permission_id": perm_id,
                            "add": "1" if perm_data.get("add") else "0",
                            "view": "1" if perm_data.get("view") else "0",
                            "update": "1" if perm_data.get("update") else "0",
                            "delete": "1" if perm_data.get("delete") else "0",
                        })
                db.commit()
            
            return role_id
        except Exception as e:
            logger.exception(f"Error in add_role: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_role(db: Session, role_id: int, role_name: str, role_key: str, permissions: List[Dict[str, Any]]) -> bool:
        try:
            # Update role
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
            update_query = text(f"""
                UPDATE {TBL_ROLES}
                SET ROLE_NAME = :name, ROLE_KEY = :key, UPDATED_AT = :updated_at
                WHERE ID = :id
            """)
            db.execute(update_query, {"id": role_id, "name": role_name, "key": role_key, "updated_at": now})
            
            # Get all permissions (like CI3 does)
            all_perms_query = text(f"SELECT ID FROM {TBL_PERMISSIONS}")
            all_perms = db.execute(all_perms_query).fetchall()
            
            # Create a map of permission IDs from the permissions list
            perm_map = {p.get("permission_id"): p for p in permissions}
            
            # Process all permissions (matching CI3 logic)
            for perm_row in all_perms:
                perm_id = dict(perm_row._mapping).get("ID")
                
                # Check if role_permission exists
                check_query = text(f"""
                    SELECT * FROM {TBL_ROLE_PERMISSIONS}
                    WHERE ROLE_ID = :role_id AND PERMISSION_ID = :permission_id
                """)
                existing = db.execute(check_query, {"role_id": role_id, "permission_id": perm_id}).fetchone()
                
                if existing:
                    # Update existing
                    perm_data = perm_map.get(perm_id, {})
                    update_perm = text(f"""
                        UPDATE {TBL_ROLE_PERMISSIONS}
                        SET ADD = :add, VIEW = :view, UPDATE = :update, DELETE = :delete
                        WHERE ROLE_ID = :role_id AND PERMISSION_ID = :permission_id
                    """)
                    db.execute(update_perm, {
                        "role_id": role_id,
                        "permission_id": perm_id,
                        "add": "1" if perm_data.get("add") else "0",
                        "view": "1" if perm_data.get("view") else "0",
                        "update": "1" if perm_data.get("update") else "0",
                        "delete": "1" if perm_data.get("delete") else "0",
                    })
                else:
                    # Insert new if permission is in the list
                    if perm_id in perm_map:
                        perm_data = perm_map[perm_id]
                        perm_insert = text(f"""
                            INSERT INTO {TBL_ROLE_PERMISSIONS} (ROLE_ID, PERMISSION_ID, ADD, VIEW, UPDATE, DELETE)
                            VALUES (:role_id, :permission_id, :add, :view, :update, :delete)
                        """)
                        db.execute(perm_insert, {
                            "role_id": role_id,
                            "permission_id": perm_id,
                            "add": "1" if perm_data.get("add") else "0",
                            "view": "1" if perm_data.get("view") else "0",
                            "update": "1" if perm_data.get("update") else "0",
                            "delete": "1" if perm_data.get("delete") else "0",
                        })
            
            db.commit()
            return True
        except Exception as e:
            logger.exception(f"Error in update_role: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_role(db: Session, role_id: int) -> bool:
        try:
            # Delete role permissions first
            delete_perms = text(f"DELETE FROM {TBL_ROLE_PERMISSIONS} WHERE ROLE_ID = :role_id")
            db.execute(delete_perms, {"role_id": role_id})
            
            # Delete role
            delete_role = text(f"DELETE FROM {TBL_ROLES} WHERE ID = :id")
            result = db.execute(delete_role, {"id": role_id})
            db.commit()
            return result.rowcount > 0
        except Exception as e:
            logger.exception(f"Error in delete_role: {e}")
            db.rollback()
            raise

