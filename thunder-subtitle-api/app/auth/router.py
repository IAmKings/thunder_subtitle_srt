"""JWT authentication endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter()


# ---- Schemas ----


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserInfo(BaseModel):
    username: str


class VerifyResponse(BaseModel):
    valid: bool
    username: str = ""


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=4)


# ---- Helpers ----


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_access_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


# ---- Endpoints ----


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate admin user and return JWT token."""
    # Single admin account: username must be "admin"
    if body.username != "admin" or body.password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(subject="admin")
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.get("/verify", response_model=VerifyResponse)
async def verify_token_get(request: Request):
    """Verify a JWT token from Authorization header. GET method for easy checking."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return VerifyResponse(
        valid=True,
        username=payload.get("sub", ""),
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_token_post(body: dict):
    """Verify a JWT token. Body: {"token": "..."}"""
    token = body.get("token", "")
    payload = verify_access_token(token)
    if payload is None:
        return VerifyResponse(valid=False)

    return VerifyResponse(
        valid=True,
        username=payload.get("sub", ""),
    )


@router.post("/change-password")
async def change_password(request: Request, body: ChangePasswordRequest):
    """Change the admin password. Requires authentication."""
    # Verify auth
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Verify old password
    if body.old_password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Old password is incorrect",
        )

    # Update password and persist to config file
    settings.admin_password = body.new_password
    from app.services.config_service import ConfigService

    ConfigService().save_password(body.new_password)

    return {"success": True, "message": "Password changed successfully"}
