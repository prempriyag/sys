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
        
        # Build redirect URL with token and user data
        params = {
            'access_token': result['access_token'],
        }
        
        # Add user data to URL (frontend will use this instead of calling /api/me)
        if 'user' in result:
            # Encode user data as JSON in URL parameter, handling datetime objects
            user_data_json = serialize_user_data_for_url(result['user'])
            params['user'] = user_data_json
        
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


@router.get("/ktech/oauth/callback")
async def ktech_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handle KTech OAuth callback
    Based on handle_response() in CI3 Ktechsso.php
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
        
        oauth_config = SSOConfig.get_ktech_oauth_config()
        result = await request_tokens(oauth_config, code, state or "", db)
        
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
        
        # Build redirect URL with token and user data
        params = {
            'access_token': result['access_token'],
        }
        
        # Add user data to URL (frontend will use this instead of calling /api/me)
        if 'user' in result:
            # Encode user data as JSON in URL parameter, handling datetime objects
            user_data_json = serialize_user_data_for_url(result['user'])
            params['user'] = user_data_json
        
        # Add permissions if available
        if 'permissions' in result:
            permissions_json = json.dumps(result['permissions'])
            params['permissions'] = permissions_json
        
        redirect_url = f"{settings.FRONTEND_URL}/sso/callback?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KTech OAuth Callback Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing OAuth callback: {str(e)}"
        )


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
        
        # Build redirect URL with token and user data
        params = {
            'access_token': result['access_token'],
        }
        
        # Add user data to URL (frontend will use this instead of calling /api/me)
        if 'user' in result:
            # Encode user data as JSON in URL parameter, handling datetime objects
            user_data_json = serialize_user_data_for_url(result['user'])
            params['user'] = user_data_json
        
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
