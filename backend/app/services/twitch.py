"""
StreamMatch — Twitch API Service.

Handles all communication with the Twitch Helix API and Twitch OAuth endpoints.
Uses httpx.AsyncClient for non-blocking HTTP requests with proper error handling.
"""

import logging
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

# Twitch API base URLs
TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/authorize"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_VALIDATE_URL = "https://id.twitch.tv/oauth2/validate"
TWITCH_HELIX_URL = "https://api.twitch.tv/helix"

# OAuth scopes required for StreamMatch
TWITCH_SCOPES = "user:read:email user:read:broadcast user:read:follows"


class TwitchAPIError(Exception):
    """Raised when a Twitch API call fails with an unexpected status."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Twitch API error {status_code}: {detail}")


class TwitchService:
    """
    Client for the Twitch Helix API and OAuth endpoints.

    All methods are async and use a shared httpx.AsyncClient for connection
    pooling. The caller is responsible for managing the client lifecycle.
    """

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
    ) -> None:
        self._http = http_client
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri

    def _helix_headers(self, access_token: str) -> dict[str, str]:
        """Build common headers for Twitch Helix API requests."""
        return {
            "Authorization": f"Bearer {access_token}",
            "Client-Id": self._client_id,
        }

    def get_auth_url(self, state: str) -> str:
        """
        Build the Twitch OAuth authorization URL.

        The state parameter is used for CSRF protection — it should be
        a random string stored in Redis before redirecting the user.
        """
        params = {
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "response_type": "code",
            "scope": TWITCH_SCOPES,
            "state": state,
            "force_verify": "true",
        }
        return f"{TWITCH_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        """
        Exchange an authorization code for access and refresh tokens.

        POST to Twitch token endpoint. Returns dict with keys:
        access_token, refresh_token, expires_in, token_type, scope.
        """
        payload = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": self._redirect_uri,
        }

        response = await self._http.post(TWITCH_TOKEN_URL, data=payload)

        if response.status_code != 200:
            logger.error("Twitch token exchange failed: %s %s", response.status_code, response.text)
            raise TwitchAPIError(
                status_code=response.status_code,
                detail="Не удалось обменять код авторизации на токен Twitch",
            )

        data = response.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "expires_in": data["expires_in"],
        }

    async def get_user(self, access_token: str) -> dict:
        """
        Fetch the authenticated user's profile from Twitch Helix API.

        GET /helix/users (no params — returns the token owner's data).
        Returns dict with: id, login, display_name, email, profile_image_url,
        broadcaster_type, description.
        """
        response = await self._http.get(
            f"{TWITCH_HELIX_URL}/users",
            headers=self._helix_headers(access_token),
        )

        if response.status_code != 200:
            logger.error("Twitch get_user failed: %s %s", response.status_code, response.text)
            raise TwitchAPIError(
                status_code=response.status_code,
                detail="Не удалось получить данные пользователя Twitch",
            )

        users = response.json().get("data", [])
        if not users:
            raise TwitchAPIError(
                status_code=404,
                detail="Пользователь Twitch не найден в ответе API",
            )

        user = users[0]
        return {
            "id": user["id"],
            "login": user["login"],
            "display_name": user["display_name"],
            "email": user.get("email"),
            "profile_image_url": user.get("profile_image_url", ""),
            "broadcaster_type": user.get("broadcaster_type", ""),
            "description": user.get("description", ""),
        }

    async def get_followers_count(self, access_token: str, broadcaster_id: str) -> int:
        """
        Get the total follower count for a broadcaster.

        GET /helix/channels/followers?broadcaster_id=...&first=1
        We only need the total, so we request minimal data (first=1).
        """
        response = await self._http.get(
            f"{TWITCH_HELIX_URL}/channels/followers",
            headers=self._helix_headers(access_token),
            params={"broadcaster_id": broadcaster_id, "first": 1},
        )

        if response.status_code != 200:
            logger.warning(
                "Twitch get_followers_count failed for %s: %s %s",
                broadcaster_id, response.status_code, response.text,
            )
            return 0

        return response.json().get("total", 0)

    async def get_streams(self, access_token: str, user_id: str) -> dict | None:
        """
        Get the current live stream for a user, if any.

        GET /helix/streams?user_id=...
        Returns stream data dict or None if the user is offline.
        """
        response = await self._http.get(
            f"{TWITCH_HELIX_URL}/streams",
            headers=self._helix_headers(access_token),
            params={"user_id": user_id},
        )

        if response.status_code != 200:
            logger.warning(
                "Twitch get_streams failed for %s: %s %s",
                user_id, response.status_code, response.text,
            )
            return None

        streams = response.json().get("data", [])
        if not streams:
            return None

        stream = streams[0]
        return {
            "game_id": stream.get("game_id", ""),
            "game_name": stream.get("game_name", ""),
            "title": stream.get("title", ""),
            "viewer_count": stream.get("viewer_count", 0),
            "language": stream.get("language", ""),
            "started_at": stream.get("started_at", ""),
        }

    async def get_channel_info(self, access_token: str, broadcaster_id: str) -> dict:
        """
        Get channel information for a broadcaster.

        GET /helix/channels?broadcaster_id=...
        Returns channel info including game_name, language, title.
        """
        response = await self._http.get(
            f"{TWITCH_HELIX_URL}/channels",
            headers=self._helix_headers(access_token),
            params={"broadcaster_id": broadcaster_id},
        )

        if response.status_code != 200:
            logger.warning(
                "Twitch get_channel_info failed for %s: %s %s",
                broadcaster_id, response.status_code, response.text,
            )
            return {"game_name": "", "game_id": "", "broadcaster_language": "ru", "title": ""}

        channels = response.json().get("data", [])
        if not channels:
            return {"game_name": "", "game_id": "", "broadcaster_language": "ru", "title": ""}

        ch = channels[0]
        return {
            "game_name": ch.get("game_name", ""),
            "game_id": ch.get("game_id", ""),
            "broadcaster_language": ch.get("broadcaster_language", "ru"),
            "title": ch.get("title", ""),
        }

    async def validate_token(self, access_token: str) -> bool:
        """
        Validate a Twitch access token.

        GET https://id.twitch.tv/oauth2/validate
        Returns True if the token is valid, False otherwise.
        """
        response = await self._http.get(
            TWITCH_VALIDATE_URL,
            headers={"Authorization": f"OAuth {access_token}"},
        )

        return response.status_code == 200
