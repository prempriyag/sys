"""
SAML Helper Functions
Based on CI3 Saml_library.php implementation
"""
import logging
from typing import Dict, Optional, Any
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils
from sqlalchemy.orm import Session
from models import User
from helpers.auth_helper import create_access_token
from helpers.db_helper import update_last_login
from helpers.permission_helper import load_user_permissions
from datetime import timedelta
from config.settings import settings

logger = logging.getLogger(__name__)


def prepare_saml_request(request_data: Dict) -> Dict:
    """
    Prepare SAML request data from FastAPI request
    """
    return {
        'https': 'on' if request_data.get('scheme') == 'https' else 'off',
        'http_host': request_data.get('host', 'localhost'),
        'script_name': request_data.get('path', '/'),
        'server_port': request_data.get('port', 443 if request_data.get('scheme') == 'https' else 80),
        'get_data': request_data.get('query_params', {}),
        'post_data': request_data.get('form_data', {}),
    }


def get_attribute_value(attributes: Dict, key: str) -> Optional[str]:
    """
    Extract attribute value from SAML attributes
    Similar to getAttributeValue in CI3 Saml_library.php
    """
    if not attributes:
        return None
    
    for attribute, values in attributes.items():
        if key.lower() in attribute.lower() and values:
            return values[0] if isinstance(values, list) else values
    return None


def process_saml_response(
    saml_config: Dict,
    request_data: Dict,
    sso_type: str = "client",
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Process SAML response and authenticate user
    Based on processResponse() in CI3 Saml_library.php
    
    Args:
        saml_config: SAML configuration dictionary
        request_data: Request data dictionary
        sso_type: "client" or "ktech"
    
    Returns:
        Dictionary with status and user info or error message
    """
    try:
        # Prepare request
        saml_request = prepare_saml_request(request_data)
        
        # Initialize SAML auth
        auth = OneLogin_Saml2_Auth(saml_request, saml_config)
        
        # Process response
        auth.process_response()
        
        # Check for errors
        errors = auth.get_errors()
        if errors:
            error_msg = 'SAML Response Errors: ' + ', '.join(errors)
            logger.error(f"SAML Error: {error_msg}")
            return {'status': 0, 'message': error_msg}
        
        # Get attributes
        attributes = auth.get_attributes()
        
        # Extract user information
        email = get_attribute_value(attributes, 'Email') or get_attribute_value(attributes, 'mail')
        first_name = get_attribute_value(attributes, 'FirstName') or get_attribute_value(attributes, 'givenName')
        last_name = get_attribute_value(attributes, 'LastName') or get_attribute_value(attributes, 'surname')
        object_id = get_attribute_value(attributes, 'UDC_IDENTIFIER') or get_attribute_value(attributes, 'objectId')
        
        name = f"{first_name} {last_name}".strip() if first_name or last_name else None
        
        user_data = {
            'email': email,
            'name': name,
            'object_id': object_id,
        }
        
        return get_userinfo(user_data, sso_type, db)
        
    except Exception as e:
        logger.error(f"SAML Processing Error: {str(e)}")
        return {'status': 0, 'message': str(e)}


def get_userinfo(user_data: Dict, sso_type: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Get or create user info from SAML/OAuth response
    Based on getUserinfo() in CI3 Saml_library.php and Aad_auth.php
    
    Args:
        user_data: Dictionary with email, name, object_id
        sso_type: "client" or "ktech"
        db: Database session (required)
    
    Returns:
        Dictionary with status, access_token, and user info
    """
    if not user_data.get('email'):
        return {
            'status': 0,
            'message': 'The email address was not received from the response. Please contact the administrator for assistance.'
        }
    
    if db is None:
        # Import here to avoid circular dependency
        from database.connection import get_db
        db = next(get_db())
    
    try:
        email = user_data['email'].lower()
        object_id = user_data.get('object_id')
        
        # Find user by email
        user = db.query(User).filter(User.email.ilike(email)).first()
        
        if not user:
            return {
                'status': 0,
                'message': f"Please contact the Admissions or Registrar's office to request that the KTech team grant access to {user_data['email']}."
            }
        
        # Update object_id if missing
        if object_id and not user.object_id:
            user.object_id = object_id
            user.updated_by = 'SSO'
            db.commit()
        
        # Check user status
        if user.status not in (1, "1"):
            return {
                'status': 0,
                'message': 'User is inactive. Please contact admin.'
            }
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": user.id,
                "role_id": user.role_id,
                "sso_type": sso_type
            },
            expires_delta=access_token_expires
        )
        
        # Load user permissions
        try:
            user_permissions = load_user_permissions(db, user.role_id, user.email)
        except Exception as e:
            logger.warning(f"Error loading permissions: {str(e)}")
            user_permissions = {}
        
        # Update last login
        try:
            update_last_login(db, user.id)
        except Exception as e:
            logger.warning(f"Error updating last login: {str(e)}")
        
        return {
            'status': 1,
            'message': 'Successfully logged in',
            'access_token': access_token,
            'token_type': 'bearer',
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role_id': user.role_id,
                'status': user.status,
                'college_perm': user.college_perm,
                'hs_perm': user.hs_perm,
                'ocr_perm': user.ocr_perm,
                'last_login': user.last_login,
            },
            'permissions': user_permissions,
            'sso_type': sso_type
        }
        
    except Exception as e:
        logger.error(f"Error in get_userinfo: {str(e)}")
        return {
            'status': 0,
            'message': f'Error processing user information: {str(e)}'
        }


def initiate_saml_login(saml_config: Dict, request_data: Dict) -> str:
    """
    Initiate SAML login - redirect to IdP
    Based on login() in CI3 Saml.php
    """
    try:
        saml_request = prepare_saml_request(request_data)
        auth = OneLogin_Saml2_Auth(saml_request, saml_config)
        return auth.login()
    except Exception as e:
        logger.error(f"SAML Login Error: {str(e)}")
        raise


def initiate_saml_logout(saml_config: Dict, request_data: Dict, name_id: str, session_index: str) -> str:
    """
    Initiate SAML logout
    Based on logout() in CI3 Saml.php
    """
    try:
        saml_request = prepare_saml_request(request_data)
        auth = OneLogin_Saml2_Auth(saml_request, saml_config)
        return auth.logout(name_id=name_id, session_index=session_index)
    except Exception as e:
        logger.error(f"SAML Logout Error: {str(e)}")
        raise
