"""
Angel One authentication service
Handles login, token refresh, and logout operations
"""
import httpx
from typing import Dict, Optional
from datetime import datetime

from config import settings
from utils.totp import generate_totp
from utils.angel_headers import build_angel_headers


class AngelAuthService:
    """Service for Angel One authentication operations"""
    
    @staticmethod
    async def login_with_credentials(
        client_id: str,
        pin: str,
        totp_secret: str,
        api_key: str
    ) -> Dict[str, str]:
        """
        Login to Angel One SmartAPI using credentials and TOTP.
        
        Args:
            client_id: Angel One client ID
            pin: Trading PIN
            totp_secret: TOTP secret for 2FA
            api_key: Angel One API key
            
        Returns:
            Dictionary containing jwtToken, refreshToken, and feedToken
            
        Raises:
            Exception: If login fails
        """
        totp = generate_totp(totp_secret)
        headers = await build_angel_headers(api_key)
        url = f"{settings.ANGEL_BASE_URL}{settings.ANGEL_LOGIN_PATH}"
        
        payload = {
            "clientcode": client_id,
            "password": pin,
            "totp": totp
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            data = response.json()
        
        if not data or data.get("status") != True:
            message = data.get("message", "Login failed") if data else "Login failed"
            raise Exception(message)
        
        return {
            "jwtToken": data["data"]["jwtToken"],
            "refreshToken": data["data"]["refreshToken"],
            "feedToken": data["data"]["feedToken"],
        }
    
    @staticmethod
    async def refresh_session(
        api_key: str,
        jwt_token: str,
        refresh_token: str
    ) -> Dict[str, str]:
        """
        Refresh JWT token using refresh token.
        
        Args:
            api_key: Angel One API key
            jwt_token: Current JWT token
            refresh_token: Refresh token
            
        Returns:
            Dictionary containing new jwtToken, refreshToken, and feedToken
            
        Raises:
            Exception: If token refresh fails
        """
        headers = await build_angel_headers(api_key, jwt_token)
        url = f"{settings.ANGEL_BASE_URL}{settings.ANGEL_GENERATE_TOKENS_PATH}"
        
        payload = {"refreshToken": refresh_token}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            data = response.json()
        
        if not data or data.get("status") != True:
            message = data.get("message", "Token refresh failed") if data else "Token refresh failed"
            raise Exception(message)
        
        return {
            "jwtToken": data["data"]["jwtToken"],
            "refreshToken": data["data"]["refreshToken"],
            "feedToken": data["data"]["feedToken"],
        }
    
    @staticmethod
    async def refresh_or_relogin(session_angel: Dict) -> Dict:
        """
        Refresh session or re-login if refresh token expired.
        
        Args:
            session_angel: Session data containing credentials and tokens
            
        Returns:
            Updated session data with new tokens
        """
        try:
            # Try to refresh using refresh token
            refreshed = await AngelAuthService.refresh_session(
                session_angel["apiKey"],
                session_angel["jwtToken"],
                session_angel["refreshToken"]
            )
            session_angel.update(refreshed)
            return session_angel
        except Exception:
            # If refresh fails, do a full re-login
            relogged = await AngelAuthService.login_with_credentials(
                session_angel["clientId"],
                session_angel["pin"],
                session_angel["totpSecret"],
                session_angel["apiKey"]
            )
            session_angel.update(relogged)
            return session_angel
    
    @staticmethod
    async def logout(api_key: str, jwt_token: str, client_id: str) -> None:
        """
        Logout from Angel One.
        
        Args:
            api_key: Angel One API key
            jwt_token: Current JWT token
            client_id: Angel One client ID
        """
        headers = await build_angel_headers(api_key, jwt_token)
        url = f"{settings.ANGEL_BASE_URL}{settings.ANGEL_LOGOUT_PATH}"
        
        payload = {"clientcode": client_id}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json=payload, headers=headers)


# Create singleton instance
angel_auth_service = AngelAuthService()

# Made with Bob
