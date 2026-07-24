"""
9:17 Buying Options Strategy Routes

Endpoints:
  GET  /options/917/state           — current strategy state
  POST /options/917/start           — start trade (scan + lock prices)
  POST /options/917/tick            — price-update tick (called every ~3 s by client)
  POST /options/917/exit            — manual exit all positions
  POST /options/917/reset           — reset for a fresh run
"""
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from services.nine_seventeen_service import nine_seventeen_service

router = APIRouter()


class ModeBody(BaseModel):
    paper: bool = True


def _angel(request: Request) -> Optional[dict]:
    return request.session.get("angel")


# ── state ─────────────────────────────────────────────────────────────────────

@router.get("/917/state")
async def get_state():
    """Current state of the 9:17 strategy."""
    try:
        return {"success": True, "strategy": nine_seventeen_service.state()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── control ───────────────────────────────────────────────────────────────────

@router.post("/917/start")
async def start_trade(request: Request, body: ModeBody):
    """
    Trigger the 09:17 scan immediately:
      1. Fetch NIFTY option chain from NSE
      2. Lock CE and PE strikes whose LTP is closest to ₹140
      3. Begin monitoring for 11.5% W&T trigger
    """
    if not body.paper and not _angel(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Live mode requires an active Angel One session. Please log in first.",
        )
    try:
        result = await nine_seventeen_service.start_trade(
            body.paper,
            angel=_angel(request),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/917/tick")
async def tick(request: Request):
    """
    Price-update tick called by the client every ~3 seconds.

    Handles:
      • Auto-scan at 09:17 if status == IDLE
      • W&T trigger check (11.5% above locked price) → entry
      • SL/TGT checks for OPEN legs
      • Force exit at 15:28 PM
    """
    try:
        result = await nine_seventeen_service.tick(angel=_angel(request))
        return {"success": True, "strategy": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/917/exit")
async def exit_all():
    """Manually exit all open/watching positions at current price."""
    try:
        result = await nine_seventeen_service.exit_all()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/917/reset")
async def reset():
    """Reset strategy state — allows re-running today."""
    try:
        result = await nine_seventeen_service.reset()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Made with Bob
