"""
Strategy routes
Handles trading strategy analysis and signals
"""
from fastapi import APIRouter, Request, Depends, HTTPException, status

from middleware.require_auth import get_current_session
from services.realtime_strategy_service import realtime_strategy_service
from services.swing_strategy_service import swing_strategy_service

router = APIRouter()


@router.get("/strong-mean-reversion")
async def get_strong_mean_reversion_signals(
    request: Request,
    index: str = "nifty500",
    session: dict = Depends(get_current_session)
):
    """
    Get Strong Mean Reversion strategy signals for selected index stocks.
    
    Uses real-time market data to build 5-minute candles and analyzes:
    - RSI (14)
    - Bollinger Bands (20, 2)
    - Volume analysis (1.5x spike)
    - EMA (200)
    
    Strategy runs in a separate thread and continuously monitors market data.
    
    Args:
        request: FastAPI request object
        index: Index to analyze (nifty50, nifty100, nifty500)
        session: Current session (injected by dependency)
        
    Returns:
        Strategy signals with buy/sell recommendations
    """
    try:
        angel = session.get("angel")
        data = await realtime_strategy_service.get_strong_mean_reversion_signals(angel, index)
        
        return {
            "success": True,
            **data
        }
    
    except Exception as err:
        error_message = str(err) or "Failed to analyze strategy"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_message
        )

# Made with Bob

@router.get("/swing")
async def get_swing_stocks(request: Request, force_refresh: bool = False, session: dict = Depends(get_current_session)):
    """
    Get Swing strategy stocks from ChartInk API.
    
    Fetches stocks near 52-week high and filters by:
    - Daily close > ₹200
    
    Uses cached data if available and less than 1 day old.
    Set force_refresh=true to fetch fresh data from ChartInk.
    
    Returns stock details including:
    - Symbol and name
    - 52-week high/low
    - Current price
    - Volume
    - Change and change percentage
    
    Args:
        request: FastAPI request object
        force_refresh: Force refresh from ChartInk API (default: False)
        session: Current session (injected by dependency)
        
    Returns:
        List of stocks matching swing strategy criteria with cache info
    """
    try:
        angel = session.get("angel")
        data = await swing_strategy_service.get_swing_stocks(angel, force_refresh)
        
        return {
            "success": True,
            **data
        }
    
    except Exception as err:
        error_message = str(err) or "Failed to fetch swing stocks"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_message
        )
