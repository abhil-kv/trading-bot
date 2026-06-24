"""
Authentication middleware for FastAPI
"""
from fastapi import Request, HTTPException, status
from typing import Dict, Optional


def get_current_session(request: Request) -> Dict:
    """
    Get the current session from the request.
    Raises HTTPException if not authenticated.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Session dictionary
        
    Raises:
        HTTPException: If not authenticated
    """
    session = request.session
    angel = session.get("angel")
    
    if not angel or not angel.get("jwtToken"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in."
        )
    
    return session


def get_optional_session(request: Request) -> Optional[Dict]:
    """
    Get the current session from the request if it exists.
    Returns None if not authenticated.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Session dictionary or None
    """
    session = request.session
    angel = session.get("angel")
    
    if not angel or not angel.get("jwtToken"):
        return None
    
    return session

# Made with Bob
