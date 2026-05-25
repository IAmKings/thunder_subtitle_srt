"""JWT authentication — dependency and token helpers for protecting FastAPI routes."""

from typing import Optional

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.config import settings


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


async def get_current_user(request: Request) -> str:
    """FastAPI dependency that extracts and validates a JWT token.

    Returns the username (subject) from the token.
    Raises 401 if token is missing or invalid.
    """
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

    username = payload.get("sub", "")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return username
