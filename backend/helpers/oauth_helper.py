"""
OAuth Helper Functions for Azure AD
Based on CI3 Aad_auth.php and Aad_auth_ktech.php implementations
"""
import logging
import secrets
import httpx
import os
import base64
from typing import Dict, Optional, Any
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from models import User
from helpers.auth_helper import create_access_token
from helpers.db_helper import update_last_login
from helpers.permission_helper import load_user_permissions
from datetime import timedelta
from config.settings import settings

logger = logging.getLogger(__name__)

# Path for storing user profile images
PROFILE_IMAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "assets", "userprofile")


def generate_nonce() -> str:
    """
    Generate a cryptographically random nonce/state
    Based on _new_guid() in CI3 Aad_auth.php
    """
    return secrets.token_urlsafe(32)


def get_authorization_url(oauth_config: Dict, state: str, return_to: Optional[str] = None) -> str:
    """
    Get Azure AD OAuth authorization URL
    Based on _get_authorization_url() in CI3 Aad_auth.php
    
    Args:
        oauth_config: OAuth configuration dictionary
        state: State/nonce for CSRF protection
        return_to: Optional return URL after authentication
    
    Returns:
        Authorization URL
    """
    tenant_id = oauth_config['tenant_id']
    client_id = oauth_config['client_id']
    redirect_uri = oauth_config['redirect_uri']
    authority = oauth_config['authority']
    resource_uri = oauth_config.get('resource_uri', 'https://graph.windows.net')
    
    authorization_endpoint = f"{authority}/{tenant_id}/oauth2/authorize"
    
    params = {
        'scope': 'openid',
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'state': state,
        'nonce': state,
        'resource': resource_uri,
    }
    
    # Add domain hint if configured
    if 'org_domain_hint' in oauth_config:
        params['domain_hint'] = oauth_config['org_domain_hint']
    
    # Add prompt for KTech SSO
    if oauth_config.get('prompt_login', False):
        params['prompt'] = 'login'
    
    return f"{authorization_endpoint}?{urlencode(params)}"


async def request_tokens(
    oauth_config: Dict,
    code: str,
    expected_nonce: str,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Exchange authorization code for access token
    Based on request_tokens() in CI3 Aad_auth.php
    
    Args:
        oauth_config: OAuth configuration dictionary
        code: Authorization code from callback
        expected_nonce: Expected nonce/state value
    
    Returns:
        Dictionary with access_token, id_token, etc. or error
    """
    tenant_id = oauth_config['tenant_id']
    client_id = oauth_config['client_id']
    client_secret = oauth_config['client_secret']
    redirect_uri = oauth_config['redirect_uri']
    authority = oauth_config['authority']
    resource_uri = oauth_config.get('resource_uri', 'https://graph.windows.net')
    
    token_endpoint = f"{authority}/{tenant_id}/oauth2/token"
    
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': client_id,
        'client_secret': client_secret,
        'resource': resource_uri,
    }
    logger.info("OAuth token request redirect_uri=%s (must match Azure app registration exactly)", redirect_uri)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_endpoint,
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=30.0
            )
            response.raise_for_status()
            token_data = response.json()
            
            if 'access_token' in token_data and 'token_type' in token_data:
                return await handle_token_response_success(token_data, oauth_config, expected_nonce, db)
            else:
                error_msg = token_data.get('error_description', 'Unknown error')
                logger.error(f"OAuth Token Error: {error_msg}")
                return {'status': 0, 'message': error_msg}
                
    except httpx.HTTPStatusError as e:
        # Surface Microsoft's error_description so redirect_uri mismatch etc. are visible
        try:
            body = e.response.json()
            err = body.get('error', '')
            desc = body.get('error_description', e.response.text or str(e))
            msg = f"{err}: {desc}" if err else desc
        except Exception:
            msg = f"HTTP Error: {str(e)}"
        logger.error("OAuth token request failed: %s", msg)
        return {'status': 0, 'message': msg}
    except Exception as e:
        logger.error(f"Error requesting tokens: {str(e)}")
        return {'status': 0, 'message': str(e)}


async def validate_token(access_token: str, resource_uri: str) -> Dict[str, Any]:
    """
    Validate access token and get user info from Microsoft Graph API
    Based on validate_token() in CI3 Aad_auth.php
    
    Args:
        access_token: Access token from OAuth flow
        resource_uri: Resource URI (graph.windows.net or graph.microsoft.com)
    
    Returns:
        Dictionary with status and user data
    """
    try:
        # Determine API endpoint based on resource URI
        if 'graph.microsoft.com' in resource_uri:
            # Use Microsoft Graph API v1.0
            graph_endpoint = 'https://graph.microsoft.com/v1.0/me'
        else:
            # Use Azure AD Graph API (legacy)
            graph_endpoint = 'https://graph.windows.net/me?api-version=1.6'
        
        async with httpx.AsyncClient() as client:
            headers = {'Authorization': f'Bearer {access_token}'}
            response = await client.get(graph_endpoint, headers=headers, timeout=30.0)
            response.raise_for_status()
            user_data = response.json()
            
            # Check for errors
            if 'odata.error' in user_data:
                error_msg = user_data['odata.error'].get('message', {}).get('value', 'Unknown error')
                return {'status': 0, 'message': error_msg}
            
            return {'status': 1, 'data': user_data}
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP Error validating token: {str(e)}")
        return {'status': 0, 'message': f'HTTP Error: {str(e)}'}
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        return {'status': 0, 'message': str(e)}


async def handle_token_response_success(
    token_response: Dict,
    oauth_config: Dict,
    expected_nonce: str,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Handle successful token response and authenticate user
    Based on _handle_token_response_success() in CI3 Aad_auth.php
    
    Args:
        token_response: Token response from Azure AD
        oauth_config: OAuth configuration
        expected_nonce: Expected nonce value
    
    Returns:
        Dictionary with status and user info
    """
    access_token = token_response['access_token']
    resource_uri = oauth_config.get('resource_uri', 'https://graph.windows.net')
    
    # Validate token and get user info
    validation_result = await validate_token(access_token, resource_uri)
    
    if validation_result['status'] == 0:
        return validation_result
    
    user_data = validation_result['data']
    
    # Extract user information based on API version
    if 'graph.microsoft.com' in resource_uri:
        # Microsoft Graph API v1.0
        email = user_data.get('mail') or user_data.get('userPrincipalName')
        name = user_data.get('displayName')
        object_id = user_data.get('id') or user_data.get('objectId')
        user_type = user_data.get('userType', 'Member')
    else:
        # Azure AD Graph API (legacy)
        email = user_data.get('mail') or user_data.get('userPrincipalName')
        name = user_data.get('displayName')
        object_id = user_data.get('objectId')
        user_type = user_data.get('userType', 'Member')
    
    if not email:
        return {
            'status': 0,
            'message': 'The email address was not received from the response. Please contact the administrator for assistance.'
        }
    
    user_info = {
        'email': email,
        'name': name,
        'object_id': object_id,
    }
    
    # Determine SSO type from config
    sso_type = "ktech" if "ktech" in oauth_config.get('redirect_uri', '').lower() else "client"
    
    # Get user info first to get the user_id
    result = get_userinfo(user_info, sso_type, db)
    
    # If login successful, try to fetch and save profile photo
    if result.get('status') == 1 and result.get('user', {}).get('id'):
        user_id = result['user']['id']
        profile_image = await fetch_and_save_profile_photo(access_token, user_id, resource_uri)
        if profile_image:
            result['user']['profile_image'] = profile_image
    
    return result


def get_userinfo(user_data: Dict, sso_type: str, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Get or create user info from OAuth response
    Based on getUserinfo() in CI3 Aad_auth.php
    
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


async def fetch_and_save_profile_photo(access_token: str, user_id: int, resource_uri: str) -> Optional[str]:
    """
    Fetch user's profile photo from Microsoft Graph API and save it locally.
    
    Args:
        access_token: OAuth access token
        user_id: User ID for saving the file
        resource_uri: Resource URI to determine which API to use
    
    Returns:
        Path to saved image or None if not available
    """
    try:
        # Ensure directory exists
        os.makedirs(PROFILE_IMAGE_DIR, exist_ok=True)
        
        # Determine photo endpoint based on resource URI
        if 'graph.microsoft.com' in resource_uri:
            # Microsoft Graph API v1.0
            photo_endpoint = 'https://graph.microsoft.com/v1.0/me/photo/$value'
        else:
            # Azure AD Graph API doesn't reliably support photos
            # Try Microsoft Graph anyway
            photo_endpoint = 'https://graph.microsoft.com/v1.0/me/photo/$value'
        
        async with httpx.AsyncClient() as client:
            headers = {'Authorization': f'Bearer {access_token}'}
            response = await client.get(photo_endpoint, headers=headers, timeout=15.0)
            
            if response.status_code == 200:
                # Save the image
                image_path = os.path.join(PROFILE_IMAGE_DIR, f"{user_id}.png")
                with open(image_path, 'wb') as f:
                    f.write(response.content)
                logger.info(f"Saved profile photo for user {user_id}")
                return f"/assets/userprofile/{user_id}.png"
            elif response.status_code == 404:
                # No photo available - this is normal
                logger.debug(f"No profile photo available for user {user_id}")
                return None
            else:
                logger.warning(f"Failed to fetch profile photo: HTTP {response.status_code}")
                return None
                
    except Exception as e:
        logger.warning(f"Error fetching profile photo: {str(e)}")
        return None


def get_logout_url(oauth_config: Dict, return_to: Optional[str] = None) -> str:
    """
    Get Azure AD logout URL
    Based on get_logout_url() in CI3 Aad_auth.php
    """
    tenant_id = oauth_config['tenant_id']
    client_id = oauth_config['client_id']
    authority = oauth_config['authority']
    logout_redirect = oauth_config.get('logout_redirect_url', return_to or '/')
    
    logout_endpoint = f"{authority}/{tenant_id}/oauth2/logout"
    return f"{logout_endpoint}?client_id={client_id}&post_logout_redirect_uri={logout_redirect}"
