"""
Authentication controller - Login, Logout, Verify
Based on Login.php controller from CodeIgniter
"""
from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User
from config.settings import settings
from schemas.auth import (
    LoginRequest, LoginResponse, VerifyCodeRequest,
    MessageResponse, UserResponse, TwoWayAuthResponse,
    ForgotPasswordRequest, ForgotPasswordResetRequest,
    ResendCodeRequest,
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
import uuid
import threading
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Authentication"])


# ---------------------------------------------------------------------------
# In-memory 2FA verification store  (matches CI3 session-based approach)
# Each entry: { temp_token: { email, verify_code, verify_data, created_at } }
# Entries expire after 3 minutes (matching CI3 timer)
# ---------------------------------------------------------------------------
_TWO_WAY_STORE: dict = {}
_TWO_WAY_LOCK = threading.Lock()
_TWO_WAY_EXPIRY_SECONDS = 180  # 3 minutes


def _cleanup_expired_tokens():
    """Remove expired 2FA tokens from the store."""
    now = datetime.utcnow()
    with _TWO_WAY_LOCK:
        expired = [
            k for k, v in _TWO_WAY_STORE.items()
            if (now - v["created_at"]).total_seconds() > _TWO_WAY_EXPIRY_SECONDS
        ]
        for k in expired:
            del _TWO_WAY_STORE[k]


def _store_two_way_data(email: str, verify_code: int, verify_data: list) -> str:
    """Store 2FA verification data and return a temp token."""
    _cleanup_expired_tokens()
    temp_token = str(uuid.uuid4())
    with _TWO_WAY_LOCK:
        # Also remove any existing tokens for this email (one active session at a time)
        existing = [k for k, v in _TWO_WAY_STORE.items() if v["email"].lower() == email.lower()]
        for k in existing:
            del _TWO_WAY_STORE[k]
        _TWO_WAY_STORE[temp_token] = {
            "email": email,
            "verify_code": verify_code,
            "verify_data": verify_data,
            "created_at": datetime.utcnow(),
            "attempts": 0,
        }
    return temp_token


def _get_two_way_data(temp_token: str) -> dict | None:
    """Retrieve 2FA data for a temp token (None if expired or not found)."""
    _cleanup_expired_tokens()
    with _TWO_WAY_LOCK:
        return _TWO_WAY_STORE.get(temp_token)


def _remove_two_way_data(temp_token: str):
    """Remove 2FA data after successful verification."""
    with _TWO_WAY_LOCK:
        _TWO_WAY_STORE.pop(temp_token, None)


def _mask_email(email: str) -> str:
    """Mask email for display: john.doe@example.com -> j****e@example.com"""
    try:
        local, domain = email.split("@")
        if len(local) <= 2:
            masked_local = local[0] + "****"
        else:
            masked_local = local[0] + "****" + local[-1]
        return f"{masked_local}@{domain}"
    except Exception:
        return "****@****"


def _build_verify_code_email(system_name: str, email: str, verify_code: int) -> str:
    """Build HTML email body for 2FA verification code (matches CI3 verify_code.php)."""
    return f"""<style>
    @import url("https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800&display=swap");
    table {{ width: 100%; border-collapse: collapse; }}
    td {{ padding: 10px; border: 1px solid #ccc; }}
    .header {{ background-color: #b31f24; font-weight: bold; padding: 10px; text-align: center; color: white; font-size: 17px; }}
    .content {{ text-align: left; }}
</style>
<body>
    <div style="text-align: center; padding-top: 5px !important; padding-bottom: 5px !important;">
        <img src="https://ktechproducts.com/wp-content/uploads/2023/05/Ktech-color-cogo-746-x-156-01.png" width="230" alt="Logo" />
    </div>
    <table>
        <tr class="header-top">
            <td colspan="2" class="header">{system_name} Verification Code</td>
        </tr>
        <tr>
            <td class="content" colspan="2">
                <h4 style="text-align: left;">Dear <span style="color: #b31f24;">{system_name} User,</span></h4>
                <p style="margin-bottom: 1rem; text-align: left;">
                    We received a request to access your {system_name} Account
                    <span style="color: blue;">{email}</span> through your email address.
                </p>
                <p style="text-align: center;"><strong>Your {system_name} verification code is:</strong></p>
                <div style="display: flex; justify-content: center;">
                    <h4 style="text-align: center; background-color: #23950014; padding: 10px 30px; border-radius: 5px; font-size: 29px; color: #239500; width: fit-content; margin: 5px;">{verify_code}</h4>
                </div>
                <p style="margin-bottom: 1rem;">
                    If you did not request this code, it is possible that someone else is
                    trying to access the {system_name} Account
                    <span style="color: blue;">{email}</span>. Do not forward or give this code
                    to anyone.
                </p>
                <p style="margin-bottom: 1rem;">
                    You received this message because this email address is listed as the
                    recovery email for the {system_name} Account
                    <span style="color: blue;">{email}</span>.
                </p>
                <p>Sincerely yours,</p>
                <p>The {system_name} Team.</p>
                <p><strong>{system_name} - Powered by</strong> <a href="https://ktechproducts.com/"><span>www.ktechproducts.com</span></a></p>
            </td>
        </tr>
    </table>
</body>"""


def _complete_login(user, db: Session) -> LoginResponse:
    """Create access token, load permissions, update last login and return LoginResponse."""
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role_id": user.role_id, "name": user.name or user.email},
        expires_delta=access_token_expires
    )

    try:
        user_permissions = load_user_permissions(db, user.role_id, user.email)
    except Exception as e:
        logger.warning("Failed to load permissions: %s", e)
        user_permissions = {}

    try:
        update_last_login(db, user.id)
    except Exception as e:
        logger.warning("Failed to update last login: %s", e)

    return LoginResponse(
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
        permissions=user_permissions,
        requires_verification=False,
    )


@router.post("/login")
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    User login endpoint.
    Based on dologin() from Login.php.
    Returns LoginResponse on success, or TwoWayAuthResponse when 2FA is needed.
    """
    import time
    start_time = time.time()

    try:
        logger.info("[LOGIN] Starting login for email: %s", login_data.email)

        # Hash password for comparison
        hashed_password = hash_password(login_data.password)

        # Find user by email (case-insensitive) and password
        user = db.query(User).filter(
            User.email.ilike(login_data.email),
            User.password == hashed_password
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Check user status (handle both string "1" and integer 1)
        if user.status not in (1, "1"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is inactive. Please contact admin."
            )

        # Validate password format
        if not password_form_validation(login_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your password is expired. Please reset by clicking Forgot Password."
            )

        # ---- Two-way verification check (matches CI3 Login.php:85-122) ----
        # CI3 logic (line 85-87):
        #   two_way_verify = getSetting('two_way_auth')  (defaults to 0 if empty)
        #   if(two_way_verify == 1 || in_array(role, except_list))
        #       → TRUE  = SKIP 2FA (direct login)
        #       → FALSE = REQUIRE 2FA (send verification code)
        #
        # So: two_way_auth == "1" means BYPASS/SKIP 2FA for everyone
        #     two_way_auth != "1" (e.g. "0" or empty) means 2FA IS required
        #     Roles in except list always skip 2FA regardless
        two_way_auth = get_setting(db, "two_way_auth")
        print(f"[2FA DEBUG] two_way_auth setting = '{two_way_auth}' (type: {type(two_way_auth)})")

        # "1" = skip 2FA for all (bypass flag); anything else = 2FA is active
        two_way_auth_bypass = two_way_auth in ("1", 1)
        print(f"[2FA DEBUG] two_way_auth_bypass = {two_way_auth_bypass}")

        role_type = roletype(db, "key", user.role_id)
        print(f"[2FA DEBUG] user role_id = {user.role_id}, role_type = '{role_type}'")

        # Parse exempt roles - these roles skip 2FA
        two_way_auth_except_raw = get_setting(db, "two_way_auth_exept")
        print(f"[2FA DEBUG] two_way_auth_exept raw = '{two_way_auth_except_raw}'")
        exempt_roles = []
        if two_way_auth_except_raw:
            try:
                exempt_roles = json.loads(two_way_auth_except_raw) if two_way_auth_except_raw else []
            except Exception as parse_err:
                print(f"[2FA DEBUG] Failed to parse except roles: {parse_err}")
                exempt_roles = []
        print(f"[2FA DEBUG] exempt_roles = {exempt_roles}")

        is_exempt = role_type and role_type.lower() in [r.lower() for r in exempt_roles]
        print(f"[2FA DEBUG] is_exempt = {is_exempt}")

        # CI3: if(two_way_verify == 1 || in_array(role, except)) → skip 2FA
        # So 2FA is required when NEITHER condition is true
        skip_2fa = two_way_auth_bypass or is_exempt
        print(f"[2FA DEBUG] skip_2fa = {skip_2fa} (bypass={two_way_auth_bypass} OR exempt={is_exempt})")
        print(f"[2FA DEBUG] RESULT: {'SKIP 2FA - direct login' if skip_2fa else 'REQUIRE 2FA - send verification code'}")

        if not skip_2fa:
            # ----- 2FA required -----
            print(f"[2FA] Generating verification codes for {user.email}")
            # Generate 3 random numbers, pick one as the correct code (matches CI3)
            verify_data = [random.randint(1, 99), random.randint(1, 99), random.randint(1, 99)]
            rand_idx = random.randint(0, 2)
            verify_code = verify_data[rand_idx]
            print(f"[2FA] verify_data={verify_data}, correct_code={verify_code} (index={rand_idx})")

            # Store in memory
            temp_token = _store_two_way_data(user.email, verify_code, verify_data)
            print(f"[2FA] Stored temp_token={temp_token[:8]}...")

            # Send verification email
            system_name = get_setting(db, "system_name") or "DigiScript"
            email_html = _build_verify_code_email(system_name, user.email, verify_code)
            print(f"[2FA] Sending email to {user.email} via SMTP...")
            email_sent = send_email(db, user.email, f"{system_name} Verification Code", email_html)

            if not email_sent:
                print(f"[2FA] WARNING: Failed to send 2FA email to {user.email}")
                logger.error("[LOGIN] Failed to send 2FA email to %s", user.email)
            else:
                print(f"[2FA] Email sent successfully to {user.email}")
                logger.info("[LOGIN] 2FA email sent to %s", user.email)

            total_time = time.time() - start_time
            print(f"[2FA] Returning TwoWayAuthResponse (took {total_time:.2f}s)")

            response_data = TwoWayAuthResponse(
                requires_verification=True,
                temp_token=temp_token,
                verify_data=verify_data,
                email_masked=_mask_email(user.email),
                message="Two-way verification required. Verification code sent to email.",
            )
            print(f"[2FA] Response: {response_data.model_dump()}")
            return response_data

        # ---- No 2FA required - complete login ----
        response = _complete_login(user, db)
        total_time = time.time() - start_time
        logger.info("[LOGIN] Login successful (no 2FA)! Total time: %.2fs", total_time)
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected exception in login: %s", e)
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
    Two-way verification code verification.
    Based on verifycode() from Login.php.
    User clicks one of the 3 numbers shown; we compare with the correct code.
    """
    temp_token = verify_data.temp_token
    submitted_code = verify_data.verifycode.strip()

    # Retrieve stored 2FA data
    stored = _get_two_way_data(temp_token)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session expired or invalid. Please login again."
        )

    # Check attempts (max 3)
    with _TWO_WAY_LOCK:
        stored["attempts"] = stored.get("attempts", 0) + 1
        if stored["attempts"] > 3:
            _TWO_WAY_STORE.pop(temp_token, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many failed attempts. Please login again."
            )

    # Compare code
    try:
        if int(submitted_code) != stored["verify_code"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect verification code. Please try again."
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code format."
        )

    # Code matches - complete login
    email = stored["email"]
    _remove_two_way_data(temp_token)

    # Fetch user from DB
    user = db.query(User).filter(
        User.email.ilike(email),
        User.status.in_([1, "1"])
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive."
        )

    response = _complete_login(user, db)
    logger.info("[VERIFY] 2FA verification successful for %s", email)
    return response


@router.post("/verify/resend", response_model=MessageResponse)
async def resend_verify_code(
    resend_data: ResendCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Resend the two-way verification code email.
    Generates new random numbers and sends a new email.
    """
    temp_token = resend_data.temp_token

    stored = _get_two_way_data(temp_token)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session expired or invalid. Please login again."
        )

    email = stored["email"]

    # Generate new codes
    verify_data = [random.randint(1, 99), random.randint(1, 99), random.randint(1, 99)]
    rand_idx = random.randint(0, 2)
    verify_code = verify_data[rand_idx]

    # Update store
    with _TWO_WAY_LOCK:
        stored["verify_code"] = verify_code
        stored["verify_data"] = verify_data
        stored["created_at"] = datetime.utcnow()
        stored["attempts"] = 0

    # Send email
    system_name = get_setting(db, "system_name") or "DigiScript"
    email_html = _build_verify_code_email(system_name, email, verify_code)
    email_sent = send_email(db, email, f"{system_name} Verification Code", email_html)

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to send verification email. Please try again."
        )

    # Return new verify_data so UI can update the numbers
    return JSONResponse(content={
        "message": "Verification code resent successfully.",
        "success": True,
        "verify_data": verify_data,
    })


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

