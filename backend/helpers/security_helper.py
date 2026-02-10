"""
Security helper functions
"""
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User
from helpers.auth_helper import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


def get_username_from_token(request: Request) -> str:
    """
    Extract the logged-in user's name from the JWT Authorization header.
    Returns the user's name from the token payload, falling back to email, then 'System'.
    This does NOT enforce authentication - it simply extracts the name if available.
    """
    try:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return "System"
        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)
        if not payload:
            return "System"
        # Try 'name' field first (added to JWT payload), then fall back to 'sub' (email)
        return payload.get("name") or payload.get("sub") or "System"
    except Exception:
        return "System"


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.email.ilike(email)).first()
    if user is None:
        raise credentials_exception
    
    # Check user status (handle both string "1" and integer 1)
    user_status = int(user.status) if user.status is not None else 0
    if user_status != 1:
        print(f"SECURITY_CHECK: User {user.email} status check failed - status={user.status} (type: {type(user.status)}), converted={user_status}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive. Please contact admin."
        )
    print(f"SECURITY_CHECK: User {user.email} status check passed - status={user.status} (type: {type(user.status)}), converted={user_status}")
    
    return user

