"""
Authentication routes
Handles login, logout, and session management
"""
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from config import settings
from services.angel_auth_service import angel_auth_service

router = APIRouter()


class LoginRequest(BaseModel):
    """Login request model"""
    clientId: str
    pin: str
    totpSecret: str
    apiKey: str
    apiSecret: Optional[str] = None


@router.get("/defaults")
async def get_defaults():
    """Get default login credentials from environment"""
    return {
        "success": True,
        "defaults": settings.default_login
    }


@router.post("/login")
async def login(request: Request, login_data: LoginRequest):
    """
    Login to Angel One with credentials.
    
    Args:
        request: FastAPI request object
        login_data: Login credentials
        
    Returns:
        Success response with client ID
    """
    # Validate required fields
    if not all([login_data.clientId, login_data.pin, login_data.totpSecret, login_data.apiKey]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field(s): clientId, pin, totpSecret, apiKey"
        )
    
    try:
        # Attempt login
        tokens = await angel_auth_service.login_with_credentials(
            login_data.clientId,
            login_data.pin,
            login_data.totpSecret,
            login_data.apiKey
        )
        
        # Store in session (server-side only, never sent to browser)
        request.session["angel"] = {
            "clientId": login_data.clientId,
            "pin": login_data.pin,
            "totpSecret": login_data.totpSecret,
            "apiKey": login_data.apiKey,
            "apiSecret": login_data.apiSecret,
            **tokens,
            "loggedInAt": datetime.utcnow().isoformat() + "Z"
        }
        
        return {
            "success": True,
            "clientId": login_data.clientId
        }
    
    except Exception as err:
        error_message = str(err) or "Login failed"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_message
        )


@router.post("/logout")
async def logout(request: Request):
    """
    Logout from Angel One and clear session.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Success response
    """
    angel = request.session.get("angel")
    
    try:
        if angel:
            # Best-effort logout from Angel One
            await angel_auth_service.logout(
                angel["apiKey"],
                angel["jwtToken"],
                angel["clientId"]
            )
    except Exception:
        pass  # Clear local session regardless
    finally:
        # Clear session
        request.session.clear()
        
        return {"success": True}


@router.get("/session")
async def get_session(request: Request):
    """
    Get current session status.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Session status with authentication state
    """
    angel = request.session.get("angel")
    
    return {
        "authenticated": bool(angel and angel.get("jwtToken")),
        "clientId": angel.get("clientId") if angel else None
    }

# Made with Bob
