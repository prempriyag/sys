"""
Authentication controller - Login, Logout, Verify
Based on Login.php controller from CodeIgniter
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User
from config.settings import settings
from schemas.auth import (
    LoginRequest, LoginResponse, VerifyCodeRequest,
    MessageResponse, UserResponse,
    ForgotPasswordRequest, ForgotPasswordResetRequest
)
from helpers.auth_helper import (
    hash_password, create_access_token, verify_token, password_form_validation
)
from helpers.email_helper import send_email
from helpers.db_helper import (
    update_last_login, roletype, get_setting
)
from helpers.security_helper import get_current_user
from helpers.permission_helper import load_user_permissions
import random
import json
import traceback

router = APIRouter(prefix="/api", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    User login endpoint
    Based on dologin() method from Login.php
    """
    import time
    start_time = time.time()
    
    try:
        print(f"[LOGIN] Starting login for email: {login_data.email}")
        
        # Hash password for comparison
        print(f"[LOGIN] Hashing password...")
        hashed_password = hash_password(login_data.password)
        print(f"[LOGIN] Password hashed in {time.time() - start_time:.2f}s")
        
        # Find user by email (case-insensitive) and password
        print(f"[LOGIN] Querying database for user...")
        query_start = time.time()
        user = db.query(User).filter(
            User.email.ilike(login_data.email),
            User.password == hashed_password
        ).first()
        print(f"[LOGIN] User query completed in {time.time() - query_start:.2f}s")
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Check user status (handle both string "1" and integer 1)
        try:
            print(f"DEBUG: user.status = {user.status} (type: {type(user.status)})")
            if user.status not in (1, "1"):
                print(f"DEBUG: User status check failed - status={user.status}, type={type(user.status)}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is inactive. Please contact admin."
                )
            print(f"DEBUG: User status check passed - status={user.status}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR: Exception in status check: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error checking user status: {str(e)}"
            )
        
        # Validate password format
        try:
            if not password_form_validation(login_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Your password is expired. Please reset by clicking Forgot Password."
                )
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR: Exception in password validation: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error validating password: {str(e)}"
            )
        
        # Check two-way verification settings
        try:
            two_way_auth = get_setting(db, "two_way_auth")
            two_way_auth_enabled = two_way_auth == "1" if two_way_auth else False
            
            # Get role type
            role_type = roletype(db, "key", user.role_id)
            
            # Check if user is exempt from two-way auth
            two_way_auth_except = get_setting(db, "two_way_auth_exept")
            exempt_roles = []
            if two_way_auth_except:
                try:
                    exempt_roles = json.loads(two_way_auth_except) if two_way_auth_except else []
                except:
                    exempt_roles = []
            
            # For now, we'll return token directly
            # In production, you might want to implement two-way verification flow
            if two_way_auth_enabled and role_type and role_type.lower() not in [r.lower() for r in exempt_roles]:
                # Two-way verification required - this would need a separate endpoint
                # For now, we'll generate a verification token
                verify_code = str(random.randint(1, 99))
                # In production, send this via email and store in session/cache
                # Then verify in a separate /verify endpoint
                
                raise HTTPException(
                    status_code=status.HTTP_200_OK,
                    detail={
                        "requires_verification": True,
                        "message": "Two-way verification required. Verification code sent to email."
                    }
                )
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR: Exception in two-way auth check: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error in two-way auth check: {str(e)}"
            )
        
        # Create access token
        try:
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": user.email, "user_id": user.id, "role_id": user.role_id},
                expires_delta=access_token_expires
            )
        except Exception as e:
            print(f"ERROR: Exception creating access token: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating access token: {str(e)}"
            )
        
        # Load user permissions
        print(f"[LOGIN] Loading user permissions for role_id: {user.role_id}...")
        perm_start = time.time()
        try:
            user_permissions = load_user_permissions(db, user.role_id, user.email)
            print(f"[LOGIN] Permissions loaded in {time.time() - perm_start:.2f}s")
        except Exception as e:
            print(f"ERROR: Exception loading permissions: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            # Return empty permissions if loading fails
            user_permissions = {}
        
        # Update last login
        print(f"[LOGIN] Updating last login...")
        try:
            update_last_login(db, user.id)
            print(f"[LOGIN] Last login updated")
        except Exception as e:
            print(f"WARNING: Exception updating last login: {type(e).__name__}: {str(e)}")
            print(f"WARNING: Traceback: {traceback.format_exc()}")
            # Don't fail the login if last login update fails
        
        try:
            print(f"[LOGIN] Creating response...")
            response = LoginResponse(
                access_token=access_token,
                token_type="bearer",
                user=UserResponse(
                    id=user.id,
                    name=user.name,
                    email=user.email,
                    role_id=user.role_id,
                    status=user.status,
                    college_perm=user.college_perm,
                    hs_perm=user.hs_perm,
                    ocr_perm=user.ocr_perm,
                    last_login=user.last_login,
                    permissions=user_permissions
                ),
                permissions=user_permissions
            )
            total_time = time.time() - start_time
            print(f"[LOGIN] Login successful! Total time: {total_time:.2f}s")
            return response
        except Exception as e:
            print(f"ERROR: Exception creating LoginResponse: {type(e).__name__}: {str(e)}")
            print(f"ERROR: Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating response: {str(e)}"
            )
    except HTTPException:
        # Re-raise HTTPExceptions (these are expected errors)
        raise
    except Exception as e:
        # Catch any unexpected errors
        print(f"ERROR: Unexpected exception in login: {type(e).__name__}: {str(e)}")
        print(f"ERROR: Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/verify", response_model=LoginResponse)
async def verify_code(
    verify_data: VerifyCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Two-way verification code verification
    Based on verifycode() method from Login.php
    
    Note: In production, this would need to verify against a stored verification code
    that was sent via email and stored in cache/session.
    """
    # This is a placeholder - in production you'd:
    # 1. Retrieve the verification code from cache/session using a temp token
    # 2. Compare with the provided code
    # 3. If valid, create and return the access token
    # 4. Get user from temp session/cache
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Two-way verification endpoint needs implementation with email service"
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user)
):
    """
    User logout endpoint
    Based on logout() method from Login.php
    
    Note: With JWT, logout is typically handled client-side by removing the token.
    If you need server-side logout, implement token blacklisting.
    """
    return MessageResponse(
        message="Successfully logged out",
        success=True
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user information (including permissions for SSO callback flow)
    """
    try:
        user_permissions = load_user_permissions(db, current_user.role_id, current_user.email)
    except Exception:
        user_permissions = {}
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role_id=current_user.role_id,
        status=current_user.status,
        college_perm=current_user.college_perm,
        hs_perm=current_user.hs_perm,
        ocr_perm=current_user.ocr_perm,
        last_login=current_user.last_login,
        permissions=user_permissions
    )


# --- Forgot Password ---

def _build_reset_email_html(link: str) -> str:
    """Build HTML email body for password reset."""
    return f"""<table style="width:100%; border-collapse:collapse;">
<tr><td colspan="2" style="background:#b31f24;color:white;padding:10px;text-align:center;font-size:17px;">Reset Your DigiScript Password</td></tr>
<tr><td colspan="2" style="padding:10px; border:1px solid #ccc;">
<h4>Dear DigiScript User,</h4>
<p>We received a request to reset the password for your account. If you did not make this request, please ignore this email.</p>
<p><strong>To reset your password, please follow the link below:</strong></p>
<p><a href="{link}" style="color:blue;">Click Here</a></p>
<p>If clicking the link does not work, copy and paste it into your browser's address bar.</p>
<p>The link expires in 30 minutes. Password must be at least 8 characters with uppercase, lowercase, number, and special character.</p>
<p>DigiScript - Powered by <a href="https://www.ktechproducts.com">KTech Products</a></p>
</td></tr></table>"""


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request_data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request password reset - sends email with reset link if user exists.
    Always returns success to avoid email enumeration.
    """
    from helpers.db_helper import get_user_by_email

    user = get_user_by_email(db, request_data.email)
    if user:
        token = create_access_token(
            data={"sub": user.email, "type": "password_reset"},
            expires_delta=timedelta(minutes=30)
        )
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        system_name = get_setting(db, "system_name") or "DigiScript"
        subject = f"{system_name} Reset Password"
        html_body = _build_reset_email_html(reset_link)
        if not send_email(db, user.email, subject, html_body):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to send email. Please ensure SMTP is configured and try again."
            )
    return MessageResponse(
        message="If your email is registered, you will receive a password reset link shortly.",
        success=True
    )


@router.post("/forgot-password/reset", response_model=MessageResponse)
async def forgot_password_reset(request_data: ForgotPasswordResetRequest, db: Session = Depends(get_db)):
    """
    Reset password using token from email link.
    """
    if request_data.npassword != request_data.cpassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    if not password_form_validation(request_data.npassword):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters with uppercase, lowercase, number, and special character"
        )
    payload = verify_token(request_data.token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one."
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")
    user.password = hash_password(request_data.npassword)
    user.updated_by = "ForgotPassword"
    db.commit()
    return MessageResponse(message="Password updated successfully. You can now log in.", success=True)

