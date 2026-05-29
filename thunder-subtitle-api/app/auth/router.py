"""JWT authentication endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, verify_access_token
from app.config import settings
from app.models.schemas import TokenVerifyRequest

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


# ---- Rate Limiter ----

_login_failures: dict[str, list[float]] = defaultdict(list)
_LOGIN_RATE_LIMIT = 5  # max failures
_LOGIN_RATE_WINDOW = 60  # seconds


def _check_login_rate_limit(ip: str) -> None:
    """Check and record a login attempt for rate limiting."""
    now = time.time()
    window_start = now - _LOGIN_RATE_WINDOW
    # Prune old entries
    _login_failures[ip] = [t for t in _login_failures[ip] if t > window_start]
    if len(_login_failures[ip]) >= _LOGIN_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="登录尝试过于频繁，请稍后再试",
        )


# ---- Helpers ----


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# ---- Endpoints ----


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    """Authenticate admin user and return JWT token."""
    # Get client IP from X-Forwarded-For or direct connection
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    elif request.client:
        ip = request.client.host
    else:
        ip = "unknown"

    _check_login_rate_limit(ip)

    # Single admin account: username must be "admin"
    if body.username != "admin" or body.password != settings.admin_password:
        _login_failures[ip].append(time.time())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Clear failure count on successful login
    _login_failures.pop(ip, None)

    token = create_access_token(subject="admin")
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.get("/verify", response_model=VerifyResponse)
async def verify_token_get(username: str = Depends(get_current_user)):
    """Verify a JWT token from Authorization header. GET method for easy checking."""
    return VerifyResponse(
        valid=True,
        username=username,
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_token_post(body: TokenVerifyRequest):
    """Verify a JWT token."""
    token = body.token
    payload = verify_access_token(token)
    if payload is None:
        return VerifyResponse(valid=False)

    return VerifyResponse(
        valid=True,
        username=payload.get("sub", ""),
    )


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    _user: str = Depends(get_current_user),
):
    """Change the admin password. Requires authentication."""
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
