"""JWT authentication — dependency for protecting FastAPI routes."""

from fastapi import HTTPException, Request, status

from app.auth.router import extract_token_from_request, verify_access_token


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
