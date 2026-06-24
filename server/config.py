"""
Configuration settings for the Trading Bot API
Loads environment variables and provides application settings
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application settings loaded from environment variables"""
    
    # Server Configuration
    PORT: int = int(os.getenv("PORT", "4000"))
    DEVELOPMENT_MODE: str = os.getenv("DEVELOPMENT_MODE", "development")
    
    # Client Configuration
    CLIENT_ORIGIN: Optional[str] = os.getenv("CLIENT_ORIGIN", "http://localhost:5173")
    
    # Session Configuration
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "dev-only-secret-change-me")
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    
    # Angel One Credentials
    CLIENT_ID: str = os.getenv("CLIENT_ID", "")
    PIN: str = os.getenv("PIN", "")
    TOTP_SECRET: str = os.getenv("TOTP_SECRET", "")
    API_KEY: str = os.getenv("API_KEY", "")
    API_SECRET: str = os.getenv("API_SECRET", "")
    
    # Cache TTL Settings
    INSTRUMENT_MASTER_TTL_MS: int = int(os.getenv("INSTRUMENT_MASTER_TTL_MS", str(24 * 60 * 60 * 1000)))
    QUOTE_CACHE_TTL_MS: int = int(os.getenv("QUOTE_CACHE_TTL_MS", "3000"))
    
    # Angel One API Endpoints
    ANGEL_BASE_URL: str = "https://apiconnect.angelone.in"
    ANGEL_LOGIN_PATH: str = "/rest/auth/angelbroking/user/v1/loginByPassword"
    ANGEL_GENERATE_TOKENS_PATH: str = "/rest/auth/angelbroking/jwt/v1/generateTokens"
    ANGEL_LOGOUT_PATH: str = "/rest/secure/angelbroking/user/v1/logout"
    ANGEL_QUOTE_PATH: str = "/rest/secure/angelbroking/market/v1/quote/"
    ANGEL_SCRIP_MASTER_URL: str = "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json"
    
    # Marketaux API Configuration
    MARKETAUX_API_KEY: str = os.getenv("MARKETAUX_API_KEY", "")
    MARKETAUX_BASE_URL: str = "https://api.marketaux.com/v1"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.DEVELOPMENT_MODE == "development"
    
    @property
    def default_login(self) -> dict:
        """Get default login credentials"""
        return {
            "clientId": self.CLIENT_ID,
            "pin": self.PIN,
            "totpSecret": self.TOTP_SECRET,
            "apiKey": self.API_KEY,
            "apiSecret": self.API_SECRET,
        }


# Create global settings instance
settings = Settings()

# Made with Bob
