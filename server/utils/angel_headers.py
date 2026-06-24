"""
Utility functions for building Angel One API request headers
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional

# Cache for public IP
_cached_public_ip: Optional[str] = None
_cached_at: Optional[datetime] = None


async def get_public_ip() -> str:
    """
    Get the public IP address of the server.
    Caches the result for 1 hour to avoid excessive API calls.
    
    Returns:
        Public IP address as string
    """
    global _cached_public_ip, _cached_at
    
    ONE_HOUR = timedelta(hours=1)
    
    # Return cached IP if still valid
    if _cached_public_ip and _cached_at and datetime.now() - _cached_at < ONE_HOUR:
        return _cached_public_ip
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get("https://api.ipify.org?format=json")
            data = response.json()
            _cached_public_ip = data["ip"]
            _cached_at = datetime.now()
            return _cached_public_ip
    except Exception as e:
        print(f"Failed to fetch public IP: {e}")
        # Fallback to placeholder IP
        return "106.51.74.45"


async def build_angel_headers(api_key: str, jwt_token: Optional[str] = None) -> dict:
    """
    Build headers required for Angel One API requests.
    
    Args:
        api_key: Angel One API key
        jwt_token: JWT token for authenticated requests (optional)
        
    Returns:
        Dictionary of headers
    """
    public_ip = await get_public_ip()
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": public_ip,
        "X-MACAddress": "fe:ff:ff:ff:ff:ff",
        "X-PrivateKey": api_key,
    }
    
    if jwt_token:
        headers["Authorization"] = f"Bearer {jwt_token}"
    
    return headers

# Made with Bob
