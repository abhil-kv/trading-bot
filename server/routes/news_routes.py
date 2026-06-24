"""
News routes
Handles fetching market news from Marketaux API
"""
import httpx
from fastapi import APIRouter, Request, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime, timedelta

from config import settings
from middleware.require_auth import get_current_session

router = APIRouter()

# Cache for news data
_news_cache = {}
CACHE_TTL = timedelta(minutes=5)


@router.get("/")
async def get_news(
    request: Request,
    session: dict = Depends(get_current_session),
    countries: str = Query(default="in"),
    filter_entities: str = Query(default="true"),
    limit: int = Query(default=10),
    published_after: Optional[str] = Query(default=None),
    language: str = Query(default="en")
):
    """
    Get market news from Marketaux API.
    
    Args:
        request: FastAPI request object
        session: Current session (injected by dependency)
        countries: Comma-separated country codes
        filter_entities: Whether to filter entities
        limit: Number of news items to fetch
        published_after: ISO timestamp for filtering news
        language: Language code
        
    Returns:
        News data with articles and metadata
    """
    if not settings.MARKETAUX_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Marketaux API key not configured. Please add MARKETAUX_API_KEY to your .env file."
        )
    
    # Create cache key from params
    cache_key = f"{countries}|{filter_entities}|{limit}|{published_after}|{language}"
    cached = _news_cache.get(cache_key)
    
    # Return cached data if still valid
    if cached and datetime.now() - cached["timestamp"] < CACHE_TTL:
        return {
            "success": True,
            **cached["data"],
            "cached": True
        }
    
    # Build params
    params = {
        "api_token": settings.MARKETAUX_API_KEY,
        "countries": countries,
        "filter_entities": filter_entities.lower() == "true",
        "limit": limit,
        "language": language,
    }
    
    if published_after:
        params["published_after"] = published_after
    
    try:
        # Fetch news from Marketaux API
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.MARKETAUX_BASE_URL}/news/all",
                params=params
            )
            data = response.json()
        
        if not data or "data" not in data:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Invalid response from Marketaux API"
            )
        
        response_data = {
            "news": data["data"],
            "meta": data.get("meta", {})
        }
        
        # Update cache
        _news_cache[cache_key] = {
            "data": response_data,
            "timestamp": datetime.now()
        }
        
        return {
            "success": True,
            **response_data,
            "cached": False
        }
    
    except httpx.HTTPError as err:
        print(f"Error fetching news: {err}")
        error_message = str(err) or "Failed to fetch news"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_message
        )
    except Exception as err:
        print(f"Error fetching news: {err}")
        error_message = str(err) or "Failed to fetch news"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_message
        )

# Made with Bob
