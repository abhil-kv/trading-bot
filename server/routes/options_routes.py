"""
Options routes — Expiry Day strategy endpoints

All control endpoints accept an optional Angel One session from the request cookie.
  • Paper mode  → session not required (simulated prices)
  • Live mode   → session required for Angel One quote API calls
"""
from fastapi import APIRouter, Request, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional

from services.expiry_options_service import expiry_options_service

router = APIRouter()


class ModeBody(BaseModel):
    paper: bool = True


def _angel(request: Request) -> Optional[dict]:
    """Extract Angel One session from the request if present (never raises)."""
    return request.session.get("angel")


# ── info / state ──────────────────────────────────────────────────────────────

@router.get("/expiry/info")
async def get_expiry_info():
    """Today's expiry calendar — upcoming expiry dates from NSE."""
    try:
        return await expiry_options_service.expiry_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/expiry/states")
async def get_all_states():
    """State for all instruments."""
    return {"success": True, "strategies": expiry_options_service.all_states()}


@router.get("/expiry/state/{instrument}")
async def get_state(instrument: str):
    return {"success": True, "strategy": expiry_options_service.state(instrument.upper())}


# ── control ───────────────────────────────────────────────────────────────────

@router.post("/expiry/schedule/{instrument}")
async def schedule(request: Request, instrument: str, body: ModeBody):
    """
    Schedule auto-entry at 10:30 AM.
    Paper mode does not require an Angel One session.
    Live mode requires a logged-in session (ticks will call Angel One quote API).
    """
    if not body.paper and not _angel(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Live mode requires an active Angel One session. Please log in first.",
        )
    try:
        result = await expiry_options_service.schedule(instrument.upper(), body.paper)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expiry/start-now/{instrument}")
async def start_now(request: Request, instrument: str, body: ModeBody):
    """
    Enter strategy immediately at current NSE prices.

    Flow:
      1. NSE option-chain-v3  → pick 4 strikes (one call, at entry only)
      2. Angel scrip master   → resolve NFO token for each strike
      3. Ticks thereafter use Angel One Quote API (live) or simulation (paper)
    """
    if not body.paper and not _angel(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Live mode requires an active Angel One session. Please log in first.",
        )
    try:
        result = await expiry_options_service.start_now(
            instrument.upper(),
            body.paper,
            angel=_angel(request),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expiry/tick/{instrument}")
async def tick(request: Request, instrument: str):
    """
    Price-update tick called by the client every ~3 seconds.

    Paper mode: simulates random-walk prices — no Angel One call.
    Live  mode: fetches real LTPs from Angel One Quote API (NFO exchange).

    Also handles:
      • 10:30 AM auto-entry if status == SCHEDULED
      • 14:55 PM force-exit of all open legs
    """
    try:
        result = await expiry_options_service.tick(
            instrument.upper(),
            angel=_angel(request),
        )
        return {"success": True, "strategy": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expiry/exit/{instrument}")
async def exit_all(instrument: str):
    """Manually exit all open legs at current price."""
    try:
        result = await expiry_options_service.exit_all(instrument.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expiry/reset/{instrument}")
async def reset(instrument: str):
    """Reset strategy state for the instrument (allows re-running)."""
    try:
        result = await expiry_options_service.reset(instrument.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Made with Bob
