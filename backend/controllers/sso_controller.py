"""
SSO Controller - Handles SAML and OAuth SSO for Client and KTech
Based on CI3 Saml.php, Sso.php, and Ktechsso.php controllers
"""
import logging
from fastapi import APIRouter, Request, Response, HTTPException, status, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database.connection import get_db
from config.sso_config import sso_config as SSOConfig
from helpers.saml_helper import (
    initiate_saml_login,
    process_saml_response,
    initiate_saml_logout
)
from helpers.oauth_helper import (
    generate_nonce,
    get_authorization_url,
    request_tokens,
    get_logout_url
)
from schemas.sso import SSOLoginResponse, OAuthCallbackRequest, SSOLogoutResponse
import json
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["SSO"])

# Router for /api/api/sso so callback works when Azure redirect URI is .../api/api/sso/...
router_double_api = APIRouter(prefix="/api/api/sso", tags=["SSO"])


def serialize_user_data_for_url(data: dict) -> str:
    """
    Serialize user data to JSON string, handling datetime objects
    Converts datetime objects to ISO format strings
    """
    # Create a copy to avoid modifying the original
    serializable_data = {}
    for key, value in data.items():
        if isinstance(value, datetime):
            # Convert datetime to ISO format string
            serializable_data[key] = value.isoformat()
        elif value is None:
            # Handle None values
            serializable_data[key] = None
        else:
            serializable_data[key] = value
    return json.dumps(serializable_data)


def format_user_data_for_response(user_data: dict) -> dict:
    """
    Format user data to include all necessary fields including permissions
    This ensures consistency with the login endpoint response
    """
    formatted_data = {
        'id': user_data.get('id'),
        'name': user_data.get('name'),
        'email': user_data.get('email'),
        'role_id': user_data.get('role_id'),
        'status': user_data.get('status'),
        'college_perm': user_data.get('college_perm', ''),
        'hs_perm': user_data.get('hs_perm', ''),
        'ocr_perm': user_data.get('ocr_perm', ''),
        'last_login': user_data.get('last_login')
    }
    
    # Convert string numbers to integers for consistency
    # Handle role_id
    if isinstance(formatted_data['role_id'], str) and formatted_data['role_id'].isdigit():
        formatted_data['role_id'] = int(formatted_data['role_id'])
    
    # Handle status - convert "1" to 1
    if isinstance(formatted_data['status'], str) and formatted_data['status'].isdigit():
        formatted_data['status'] = int(formatted_data['status'])
    
    # Handle college_perm
    if isinstance(formatted_data['college_perm'], str) and formatted_data['college_perm'].isdigit():
        formatted_data['college_perm'] = int(formatted_data['college_perm'])
    elif formatted_data['college_perm'] == '':
        formatted_data['college_perm'] = 0  # Default to 0 if empty
    
    # Handle hs_perm
    if isinstance(formatted_data['hs_perm'], str) and formatted_data['hs_perm'].isdigit():
        formatted_data['hs_perm'] = int(formatted_data['hs_perm'])
    elif formatted_data['hs_perm'] == '':
        formatted_data['hs_perm'] = 0  # Default to 0 if empty
    
    # Handle ocr_perm
    if isinstance(formatted_data['ocr_perm'], str) and formatted_data['ocr_perm'].isdigit():
        formatted_data['ocr_perm'] = int(formatted_data['ocr_perm'])
    elif formatted_data['ocr_perm'] == '':
        formatted_data['ocr_perm'] = 0  # Default to 0 if empty

    # Handle datetime conversion for last_login
    if formatted_data['last_login'] and isinstance(formatted_data['last_login'], datetime):
        formatted_data['last_login'] = formatted_data['last_login'].isoformat()
    
    return formatted_data


# ==================== UNIFIED SSO ENTRY POINTS ====================

@router.get("/client")
async def client_sso_login(
    request: Request,
    return_to: Optional[str] = Query(None)
):
    """
    Unified Client SSO entry point
    Automatically routes to OAuth or SAML based on configuration
    """
    try:
        sso_method = SSOConfig.get_client_sso_method()
        
        if not sso_method:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Client SSO is not configured. Please configure either OAuth or SAML."
            )
        
        if sso_method == 'oauth':
            # Redirect to OAuth login
            oauth_config = SSOConfig.get_client_oauth_config()
            if not oauth_config.get('tenant_id') or not oauth_config.get('client_id'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Client OAuth configuration is not set up"
                )
            state = generate_nonce()
            auth_url = get_authorization_url(oauth_config, state, return_to)
            return RedirectResponse(url=auth_url)
        elif sso_method == 'saml':
            # Redirect to SAML login
            saml_config = SSOConfig.get_client_saml_config()
            if not saml_config.get('sp', {}).get('entityId'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Client SAML configuration is not set up"
                )
            request_data = {
                'scheme': request.url.scheme,
                'host': request.url.hostname,
                'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
                'path': request.url.path,
                'query_params': dict(request.query_params),
            }
            redirect_url = initiate_saml_login(saml_config, request_data)
            return RedirectResponse(url=redirect_url)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid SSO method: {sso_method}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Client SSO Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating SSO login: {str(e)}"
        )


@router.get("/ktech")
async def ktech_sso_login(
    request: Request,
    return_to: Optional[str] = Query(None)
):
    """
    Unified KTech SSO entry point
    Automatically routes to OAuth or SAML based on configuration
    """
    try:
        sso_method = SSOConfig.get_ktech_sso_method()
        
        if not sso_method:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="KTech SSO is not configured. Please configure either OAuth or SAML."
            )
        
        if sso_method == 'oauth':
            # Redirect to OAuth login
            oauth_config = SSOConfig.get_ktech_oauth_config()
            oauth_config['prompt_login'] = True  # Force login prompt for KTech
            if not oauth_config.get('tenant_id') or not oauth_config.get('client_id'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="KTech OAuth configuration is not set up"
                )
            state = generate_nonce()
            auth_url = get_authorization_url(oauth_config, state, return_to)
            return RedirectResponse(url=auth_url)
        elif sso_method == 'saml':
            # Redirect to SAML login
            saml_config = SSOConfig.get_ktech_saml_config()
            if not saml_config.get('sp', {}).get('entityId'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="KTech SAML configuration is not set up"
                )
            request_data = {
                'scheme': request.url.scheme,
                'host': request.url.hostname,
                'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
                'path': request.url.path,
                'query_params': dict(request.query_params),
            }
            redirect_url = initiate_saml_login(saml_config, request_data)
            return RedirectResponse(url=redirect_url)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid SSO method: {sso_method}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KTech SSO Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating SSO login: {str(e)}"
        )


# ==================== CLIENT SSO - OAuth ====================

@router.get("/client/oauth/login")
async def client_oauth_login(
    request: Request,
    return_to: Optional[str] = Query(None)
):
    """
    Initiate Client OAuth login
    Based on index() in CI3 Sso.php
    """
    try:
        oauth_config = SSOConfig.get_client_oauth_config()
        
        if not oauth_config.get('tenant_id') or not oauth_config.get('client_id'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Client OAuth configuration is not set up"
            )
        
        state = generate_nonce()
        
        # Store state in session (in production, use Redis or similar)
        # For now, we'll pass it in the redirect URL
        auth_url = get_authorization_url(oauth_config, state, return_to)
        
        return RedirectResponse(url=auth_url)
        
    except Exception as e:
        logger.error(f"Client OAuth Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating OAuth login: {str(e)}"
        )


@router.get("/client/oauth/callback")
async def client_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handle Client OAuth callback
    Based on handle_response() in CI3 Sso.php
    """
    try:
        if error:
            logger.error(f"OAuth Error: {error} - {error_description}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_description or error
            )
        
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code not provided"
            )
        
        # In production, validate state against stored session value
        # For now, we'll proceed with the code exchange
        
        oauth_config = SSOConfig.get_client_oauth_config()
        result = await request_tokens(oauth_config, code, state or "", db)
        
        if result['status'] == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result['message']
            )
        
        # For API responses, return JSON (not redirect)
        # This endpoint can be called directly or via redirect
        return SSOLoginResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Client OAuth Callback Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing OAuth callback: {str(e)}"
        )


@router.get("/client/oauth/logout")
async def client_oauth_logout(return_to: Optional[str] = Query(None)):
    """
    Client OAuth logout
    Based on logout() in CI3 Sso.php
    """
    try:
        oauth_config = SSOConfig.get_client_oauth_config()
        logout_url = get_logout_url(oauth_config, return_to)
        return RedirectResponse(url=logout_url)
    except Exception as e:
        logger.error(f"Client OAuth Logout Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during logout: {str(e)}"
        )


# ==================== CLIENT SSO - SAML ====================

@router.get("/client/saml/login")
async def client_saml_login(request: Request):
    """
    Initiate Client SAML login
    Based on login() in CI3 Saml.php
    """
    try:
        saml_config = SSOConfig.get_client_saml_config()
        
        if not saml_config.get('sp', {}).get('entityId'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Client SAML configuration is not set up"
            )
        
        # Prepare request data
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
        }
        
        redirect_url = initiate_saml_login(saml_config, request_data)
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"Client SAML Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating SAML login: {str(e)}"
        )


@router.post("/client/saml/callback")
async def client_saml_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle Client SAML callback
    Based on callback() in CI3 Saml.php
    """
    try:
        form_data = await request.form()
        
        # Prepare request data
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
            'form_data': dict(form_data),
        }
        
        saml_config = SSOConfig.get_client_saml_config()
        result = process_saml_response(saml_config, request_data, "client")
        
        if result['status'] == 0:
            # Redirect to frontend with error
            from config.settings import settings
            from urllib.parse import urlencode
            error_params = urlencode({
                'error': 'authentication_failed',
                'error_description': result['message']
            })
            redirect_url = f"{settings.FRONTEND_URL}/sso/callback?{error_params}"
            return RedirectResponse(url=redirect_url)
        
        # Redirect to frontend with token and user data (matching CI3 behavior)
        from config.settings import settings
        from urllib.parse import urlencode
        import json
        
        # Format user data to include all fields including permissions
        if 'user' in result:
            formatted_user_data = format_user_data_for_response(result['user'])
            user_data_json = serialize_user_data_for_url(formatted_user_data)
        else:
            user_data_json = "{}"
        
        # Build redirect URL with token and user data
        params = {
            'access_token': result['access_token'],
            'user': user_data_json
        }
        
        # Add permissions if available
        if 'permissions' in result:
            permissions_json = json.dumps(result['permissions'])
            params['permissions'] = permissions_json
        
        redirect_url = f"{settings.FRONTEND_URL}/sso/callback?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Client SAML Callback Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing SAML callback: {str(e)}"
        )


@router.get("/client/saml/sls")
async def client_saml_sls(request: Request):
    """
    Handle Client SAML Single Logout Service
    Based on sls() in CI3 Saml.php
    """
    try:
        saml_config = SSOConfig.get_client_saml_config()
        
        # Prepare request data
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
        }
        
        # For logout, we need name_id and session_index from the request
        # This is a simplified version
        redirect_url = initiate_saml_logout(saml_config, request_data, "", "")
        return RedirectResponse(url=redirect_url or "/")
        
    except Exception as e:
        logger.error(f"Client SAML SLS Error: {str(e)}")
        return RedirectResponse(url="/")


# ==================== KTech SSO - OAuth ====================

@router.get("/ktech/oauth/login")
async def ktech_oauth_login(
    request: Request,
    return_to: Optional[str] = Query(None)
):
    """
    Initiate KTech OAuth login
    Based on index() in CI3 Ktechsso.php
    """
    try:
        oauth_config = SSOConfig.get_ktech_oauth_config()
        oauth_config['prompt_login'] = True  # Force login prompt for KTech
        
        if not oauth_config.get('tenant_id') or not oauth_config.get('client_id'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="KTech OAuth configuration is not set up"
            )
        
        state = generate_nonce()
        auth_url = get_authorization_url(oauth_config, state, return_to)
        
        return RedirectResponse(url=auth_url)
        
    except Exception as e:
        logger.error(f"KTech OAuth Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating OAuth login: {str(e)}"
        )


def _redirect_sso_error(message: str) -> RedirectResponse:
    """Redirect to frontend SSO callback with error. Avoids 4xx/5xx so proxy never returns 502."""
    from config.settings import settings
    from urllib.parse import urlencode
    params = urlencode({
        'error': 'authentication_failed',
        'error_description': message[:500]  # avoid overly long URLs
    })
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/sso/callback?{params}")


@router.get("/ktech/oauth/callback")
async def ktech_oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handle KTech OAuth callback. Always returns 302 redirect (never 4xx/5xx) so reverse
    proxy does not turn backend errors into 502 Bad Gateway.
    """
    try:
        if error:
            logger.error(f"OAuth Error: {error} - {error_description}")
            return _redirect_sso_error(error_description or error or "OAuth error")
        if not code:
            return _redirect_sso_error("Authorization code not provided")
        oauth_config = SSOConfig.get_ktech_oauth_config()
        result = await request_tokens(oauth_config, code, state or "", db)
        if result['status'] == 0:
            return _redirect_sso_error(result.get('message', 'Token exchange failed'))
        from config.settings import settings
        from urllib.parse import urlencode
        if 'user' in result:
            formatted_user_data = format_user_data_for_response(result['user'])
            user_data_json = serialize_user_data_for_url(formatted_user_data)
        else:
            user_data_json = "{}"
        params = {
            'access_token': result['access_token'],
            'user': user_data_json
        }
        if 'permissions' in result:
            params['permissions'] = json.dumps(result['permissions'])
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/sso/callback?{urlencode(params)}")
    except Exception as e:
        logger.exception("KTech OAuth Callback Error")
        return _redirect_sso_error(str(e)[:500])


# Expose same callback at /api/api/sso/... for prod when redirect URI has double /api
router_double_api.add_api_route("/ktech/oauth/callback", ktech_oauth_callback, methods=["GET"])


@router.get("/ktech/oauth/logout")
async def ktech_oauth_logout(return_to: Optional[str] = Query(None)):
    """
    KTech OAuth logout
    Based on logout() in CI3 Ktechsso.php
    """
    try:
        oauth_config = SSOConfig.get_ktech_oauth_config()
        logout_url = get_logout_url(oauth_config, return_to)
        return RedirectResponse(url=logout_url)
    except Exception as e:
        logger.error(f"KTech OAuth Logout Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during logout: {str(e)}"
        )


# ==================== KTech SSO - SAML ====================

@router.get("/ktech/saml/login")
async def ktech_saml_login(request: Request):
    """
    Initiate KTech SAML login
    Based on login() in CI3 Saml.php
    """
    try:
        saml_config = SSOConfig.get_ktech_saml_config()
        
        if not saml_config.get('sp', {}).get('entityId'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="KTech SAML configuration is not set up"
            )
        
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
        }
        
        redirect_url = initiate_saml_login(saml_config, request_data)
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"KTech SAML Login Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating SAML login: {str(e)}"
        )


@router.post("/ktech/saml/callback")
async def ktech_saml_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle KTech SAML callback
    Based on callback() in CI3 Saml.php
    """
    try:
        form_data = await request.form()
        
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
            'form_data': dict(form_data),
        }
        
        saml_config = SSOConfig.get_ktech_saml_config()
        result = process_saml_response(saml_config, request_data, "ktech", db)
        
        if result['status'] == 0:
            # Redirect to frontend with error
            from config.settings import settings
            from urllib.parse import urlencode
            error_params = urlencode({
                'error': 'authentication_failed',
                'error_description': result['message']
            })
            redirect_url = f"{settings.FRONTEND_URL}/sso/callback?{error_params}"
            return RedirectResponse(url=redirect_url)
        
        # Redirect to frontend with token and user data (matching CI3 behavior)
        from config.settings import settings
        from urllib.parse import urlencode
        import json
        
        # Format user data to include all fields including permissions
        if 'user' in result:
            formatted_user_data = format_user_data_for_response(result['user'])
            user_data_json = serialize_user_data_for_url(formatted_user_data)
        else:
            user_data_json = "{}"
        
        # Build redirect URL with token and user data
        params = {
            'access_token': result['access_token'],
            'user': user_data_json
        }
        
        # Add permissions if available
        if 'permissions' in result:
            permissions_json = json.dumps(result['permissions'])
            params['permissions'] = permissions_json
        
        redirect_url = f"{settings.FRONTEND_URL}/sso/callback?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KTech SAML Callback Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing SAML callback: {str(e)}"
        )


@router.get("/ktech/saml/sls")
async def ktech_saml_sls(request: Request):
    """
    Handle KTech SAML Single Logout Service
    Based on sls() in CI3 Saml.php
    """
    try:
        saml_config = SSOConfig.get_ktech_saml_config()
        
        request_data = {
            'scheme': request.url.scheme,
            'host': request.url.hostname,
            'port': request.url.port or (443 if request.url.scheme == 'https' else 80),
            'path': request.url.path,
            'query_params': dict(request.query_params),
        }
        
        redirect_url = initiate_saml_logout(saml_config, request_data, "", "")
        return RedirectResponse(url=redirect_url or "/")
        
    except Exception as e:
        logger.error(f"KTech SAML SLS Error: {str(e)}")
        return RedirectResponse(url="/")