"""
Market data routes
Handles fetching market quotes and data
"""
from fastapi import APIRouter, Request, Depends, HTTPException, status

from middleware.require_auth import get_current_session
from services.market_data_service import market_data_service

router = APIRouter()


@router.get("/nifty50")
async def get_nifty50(request: Request, session: dict = Depends(get_current_session)):
    """
    Get Nifty 50 stock quotes.
    
    Args:
        request: FastAPI request object
        session: Current session (injected by dependency)
        
    Returns:
        Market data for Nifty 50 stocks
    """
    try:
        angel = session.get("angel")
        data = await market_data_service.get_nifty50_quotes(angel)
        
        # Session is automatically saved by FastAPI's SessionMiddleware
        
        return {
            "success": True,
            **data
        }
    
    except Exception as err:
        error_message = str(err) or "Failed to fetch market data"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_message
        )

# Made with Bob
