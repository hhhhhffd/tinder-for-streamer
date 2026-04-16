"""
StreamMatch — Authentication Service.

Handles JWT creation, verification, and httpOnly cookie management.
JWTs carry the user_id in the 'sub' claim and are stored in a
secure, httpOnly cookie named 'streammatch_token'.
"""

from datetime import datetime, timedelta, timezone

from fastapi import Response
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

# Cookie name used across the application
AUTH_COOKIE_NAME = "streammatch_token"


class AuthService:
    """Stateless helper for JWT tokens and auth cookies."""

    @staticmethod
    def create_jwt(user_id: str) -> str:
        """
        Create a signed JWT containing the user's ID.

        Claims:
        - sub: user UUID as string (subject)
        - iat: issued-at timestamp
        - exp: expiration timestamp (now + JWT_EXPIRATION_MINUTES)
        """
        now = datetime.now(timezone.utc)
        payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(minutes=settings.jwt_expiration_minutes),
        }
        return jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

    @staticmethod
    def verify_jwt(token: str) -> dict:
        """
        Decode and validate a JWT.

        Returns the payload dict if valid.
        Raises JWTError if the token is expired, tampered, or malformed.
        """
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

    @staticmethod
    def set_auth_cookie(response: Response, token: str) -> None:
        """
        Set the JWT as an httpOnly, Secure, SameSite=Lax cookie.

        The cookie name is 'streammatch_token' and it expires after
        JWT_EXPIRATION_MINUTES. httpOnly prevents JavaScript access,
        Secure ensures HTTPS-only transmission in production.
        """
        response.set_cookie(
            key=AUTH_COOKIE_NAME,
            value=token,
            max_age=settings.jwt_expiration_minutes * 60,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )

    @staticmethod
    def clear_auth_cookie(response: Response) -> None:
        """
        Remove the auth cookie by setting it to an empty value with max_age=0.
        """
        response.delete_cookie(
            key=AUTH_COOKIE_NAME,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )
