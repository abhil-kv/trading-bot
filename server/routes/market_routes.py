"""
Market data routes
Handles fetching market quotes and data
"""
from fastapi import APIRouter, Request, Depends, HTTPException, status

from middleware.require_auth import get_current_session
from services.market_data_service import market_data_service
from services.nse_indices_service import get_indices

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


@router.get("/nifty100")
async def get_nifty100(request: Request, session: dict = Depends(get_current_session)):
    """
    Get Nifty 100 stock quotes.
    
    Args:
        request: FastAPI request object
        session: Current session (injected by dependency)
        
    Returns:
        Market data for Nifty 100 stocks
    """
    try:
        angel = session.get("angel")
        data = await market_data_service.get_nifty100_quotes(angel)
        
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


@router.get("/nifty500")
async def get_nifty500(request: Request, session: dict = Depends(get_current_session)):
    """
    Get Nifty 500 stock quotes.
    
    Args:
        request: FastAPI request object
        session: Current session (injected by dependency)
        
    Returns:
        Market data for Nifty 500 stocks
    """
    try:
        angel = session.get("angel")
        data = await market_data_service.get_nifty500_quotes(angel)
        
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

@router.get("/indices")
async def get_market_indices():
    """
    Get live index quotes for NIFTY, BANK NIFTY, FINNIFTY, MIDCPNIFTY, SENSEX.
    No authentication required — data is sourced from NSE's public API.
    """
    try:
        data = await get_indices()
        return {"success": True, "indices": data}
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(err) or "Failed to fetch index data",
        )


# Made with Bob
