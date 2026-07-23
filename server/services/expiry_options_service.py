"""
Expiry Day Options Strategy Service

Architecture:
  ┌─ Entry (once) ────────────────────────────────────────────────────────────┐
  │  1. NSE contract-info API  → get valid expiry dates (holidays excluded)   │
  │  2. NSE option-chain-v3 API → pick 4 strikes near ₹20 (sell) / ₹5 (buy) │
  │  3. Angel One scrip master → resolve each strike to an NFO token          │
  └───────────────────────────────────────────────────────────────────────────┘
  ┌─ Monitoring (every tick) ──────────────────────────────────────────────────┐
  │  Angel One Quote API (NFO, mode=LTP) → live LTPs for the 4 tokens         │
  │  No further NSE API calls after entry.                                    │
  └───────────────────────────────────────────────────────────────────────────┘

Paper mode (TRADING_MODE=test or UI toggle):
  • NSE chain still fetched once to get REAL strikes and entry prices.
  • Angel One scrip master token lookup still runs (needed for live switch).
  • Price ticks are SIMULATED (random walk) — no Angel One quote API called.
  • Used when there is no valid Angel One session.

Live mode:
  • Exactly the same entry flow.
  • Every tick calls Angel One Quote API for live LTPs.
  • Requires a valid Angel One session (jwtToken + apiKey).

Strategy rules:
  L1  SELL PUT  ~₹20  SL = entry × 2  (100% loss — double price)
  L2  SELL CALL ~₹20  SL = entry × 2
  L3  BUY  CALL ~₹5   TGT = entry × 3 (200% gain)  SL = ₹0.05
  L4  BUY  PUT  ~₹5   TGT = entry × 3              SL = ₹0.05

  Entry:       10:30 AM (scheduled) or immediately (start-now)
  Force exit:  14:55 PM
"""

from __future__ import annotations

import random
import threading
from datetime import date, datetime, time as dt_time
from typing import Dict, List, Optional

# ──────────────────────────────────────────────────────────────────────────────
# Lot sizes (also referenced by nse_option_chain_service normaliser)
# ──────────────────────────────────────────────────────────────────────────────

LOT_SIZES: Dict[str, int] = {
    "NIFTY":      25,
    "BANKNIFTY":  15,
    "FINNIFTY":   40,
    "MIDCPNIFTY": 50,
}

LOTS_PER_LEG = 10   # 10 lots per leg as per strategy spec


# ──────────────────────────────────────────────────────────────────────────────
# Nearest-strike picker (used at entry only, from NSE chain)
# ──────────────────────────────────────────────────────────────────────────────

def pick_nearest(chain: List[Dict], opt_type: str, target: float) -> Optional[Dict]:
    """
    Return the option of the given type (CE / PE) whose LTP is closest to target.
    Ignores zero-LTP options (illiquid / no market).
    CE and PE always searched independently → different strikes.
    """
    candidates = [o for o in chain if o["type"] == opt_type and (o.get("ltp") or 0) > 0]
    return min(candidates, key=lambda o: abs(o["ltp"] - target)) if candidates else None


# ──────────────────────────────────────────────────────────────────────────────
# Leg builder  (called once at entry — uses NSE chain data)
# ──────────────────────────────────────────────────────────────────────────────

def build_legs(chain: List[Dict], instrument: str, expiry_str: str) -> List[Dict]:
    """
    Select the 4 strategy legs from the NSE option chain.

    Leg order:
      L1  SELL PE  nearest to ₹20
      L2  SELL CE  nearest to ₹20
      L3  BUY  CE  nearest to ₹5
      L4  BUY  PE  nearest to ₹5

    Each leg dict contains NSE market data (entry price, strike, tradingSymbol)
    plus placeholder fields that angel_option_service.resolve_tokens() will fill
    (angelSymbol, angelToken).
    """
    lot = LOT_SIZES.get(instrument, 25)
    qty = LOTS_PER_LEG * lot

    specs = [
        ("L1", "SELL", "PE", 20.0),
        ("L2", "SELL", "CE", 20.0),
        ("L3", "BUY",  "CE",  5.0),
        ("L4", "BUY",  "PE",  5.0),
    ]

    legs: List[Dict] = []
    for leg_id, action, opt_type, target_ltp in specs:
        opt = pick_nearest(chain, opt_type, target_ltp)
        if opt is None:
            continue
        ep = opt["ltp"]

        if action == "SELL":
            sl_price  = round(ep * 2.0, 2)   # 100% above entry → 2×
            tgt_price = None                  # no fixed target for sell legs
        else:
            sl_price  = 0.05                  # 100% loss → option near worthless
            tgt_price = round(ep * 3.0, 2)   # 200% gain → 3×

        legs.append({
            "legId":         leg_id,
            "action":        action,
            "optionType":    opt_type,
            "strike":        opt["strike"],
            "tradingSymbol": opt["tradingSymbol"],   # NSE symbol (4-digit year)
            "expiry":        expiry_str,
            "underlying":    opt.get("underlying"),
            "lotSize":       lot,
            "lots":          LOTS_PER_LEG,
            "quantity":      qty,
            "entryPrice":    ep,
            "currentPrice":  ep,
            "slPrice":       sl_price,
            "tgtPrice":      tgt_price,
            "status":        "OPEN",    # OPEN | SL_HIT | TGT_HIT | EXITED
            "realizedPnl":   0.0,
            "unrealizedPnl": 0.0,
            # Filled by angel_option_service.resolve_tokens():
            "angelSymbol":   "",
            "angelToken":    "",
        })
    return legs


# ──────────────────────────────────────────────────────────────────────────────
# Per-leg P&L helpers
# ──────────────────────────────────────────────────────────────────────────────

def _unrealized(leg: Dict) -> float:
    ep, cp, qty = leg["entryPrice"], leg["currentPrice"], leg["quantity"]
    if leg["action"] == "SELL":
        return round((ep - cp) * qty, 2)
    return round((cp - ep) * qty, 2)


def update_leg_price(leg: Dict, new_price: float) -> bool:
    """
    Update current price, recalculate unrealized PnL, and trigger SL / TGT.
    Returns True when the leg just closed (so caller can log the event).
    """
    if leg["status"] != "OPEN":
        return False

    new_price = max(round(new_price, 2), 0.05)
    leg["currentPrice"]  = new_price
    leg["unrealizedPnl"] = _unrealized(leg)

    ep, qty = leg["entryPrice"], leg["quantity"]

    if leg["action"] == "SELL":
        if new_price >= leg["slPrice"]:
            leg["status"]        = "SL_HIT"
            leg["realizedPnl"]   = round((ep - new_price) * qty, 2)
            leg["unrealizedPnl"] = 0.0
            return True
    else:
        if leg["tgtPrice"] and new_price >= leg["tgtPrice"]:
            leg["status"]        = "TGT_HIT"
            leg["realizedPnl"]   = round((new_price - ep) * qty, 2)
            leg["unrealizedPnl"] = 0.0
            return True
        if new_price <= leg["slPrice"]:
            leg["status"]        = "SL_HIT"
            leg["realizedPnl"]   = round((new_price - ep) * qty, 2)
            leg["unrealizedPnl"] = 0.0
            return True

    return False


def force_exit_leg(leg: Dict):
    """Close an open leg at current price (time-based force exit at 14:55)."""
    if leg["status"] == "OPEN":
        leg["status"]        = "EXITED"
        leg["realizedPnl"]   = _unrealized(leg)
        leg["unrealizedPnl"] = 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Paper-mode price simulation
# ──────────────────────────────────────────────────────────────────────────────

_sim_prices: Dict[str, float] = {}


def simulate_tick(token: str, base: float) -> float:
    """Random-walk step around the last simulated price (±8% per tick)."""
    last   = _sim_prices.get(token, base)
    change = random.uniform(-0.08, 0.08)
    new    = max(0.05, last * (1 + change))
    _sim_prices[token] = new
    return round(new, 2)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy state
# ──────────────────────────────────────────────────────────────────────────────

class StrategyState:
    """Thread-safe state for one instrument's expiry strategy run."""

    def __init__(self, instrument: str):
        self.instrument  = instrument
        self.run_date    = date.today()
        self.status      = "IDLE"     # IDLE | SCHEDULED | RUNNING | EXITED
        self.paper_mode  = True
        self.expiry_str: Optional[str] = None
        self.entry_time: Optional[str] = None
        self.exit_time:  Optional[str] = None
        self.legs:       List[Dict]    = []
        self.log:        List[Dict]    = []
        self._lock = threading.Lock()

    # ── computed helpers ─────────────────────────────────────────────────────

    @property
    def total_realized(self) -> float:
        return sum(l.get("realizedPnl", 0) for l in self.legs)

    @property
    def total_unrealized(self) -> float:
        return sum(l.get("unrealizedPnl", 0) for l in self.legs if l["status"] == "OPEN")

    @property
    def total_pnl(self) -> float:
        return round(self.total_realized + self.total_unrealized, 2)

    @property
    def open_legs(self) -> int:
        return sum(1 for l in self.legs if l["status"] == "OPEN")

    # ── serialisation ────────────────────────────────────────────────────────

    def to_dict(self) -> Dict:
        with self._lock:
            return {
                "instrument":      self.instrument,
                "runDate":         self.run_date.isoformat(),
                "status":          self.status,
                "paperMode":       self.paper_mode,
                "expiryStr":       self.expiry_str,
                "entryTime":       self.entry_time,
                "exitTime":        self.exit_time,
                "legs":            list(self.legs),
                "log":             list(self.log),
                "openLegs":        self.open_legs,
                "totalRealized":   round(self.total_realized, 2),
                "totalUnrealized": round(self.total_unrealized, 2),
                "totalPnl":        self.total_pnl,
            }

    # ── log helper ───────────────────────────────────────────────────────────

    def _log(self, event: str, message: str, leg_id: str = ""):
        self.log.append({
            "time":    datetime.now().strftime("%H:%M:%S"),
            "event":   event,
            "legId":   leg_id,
            "message": message,
        })


# ──────────────────────────────────────────────────────────────────────────────
# Global registry
# ──────────────────────────────────────────────────────────────────────────────

_registry: Dict[str, StrategyState] = {}
_reg_lock = threading.Lock()


def get_state(instrument: str) -> StrategyState:
    """Get (or create today's fresh) StrategyState for the instrument."""
    with _reg_lock:
        today = date.today()
        existing = _registry.get(instrument)
        if existing is None or existing.run_date != today:
            _registry[instrument] = StrategyState(instrument)
        return _registry[instrument]


# ──────────────────────────────────────────────────────────────────────────────
# Service
# ──────────────────────────────────────────────────────────────────────────────

class ExpiryOptionsService:

    # ── expiry calendar info ──────────────────────────────────────────────────

    async def expiry_info(self) -> Dict:
        """
        Return today's date, day-of-week, and the upcoming expiry from NSE.
        Shows which instruments have a weekly expiry today.
        """
        from services.nse_option_chain_service import (
            get_expiry_dates_for_symbol,
            _parse_nse_date,
        )
        today = date.today()

        try:
            all_dates, upcoming = await get_expiry_dates_for_symbol("NIFTY")

            # Find instruments whose NEAREST expiry is today (expiry day check)
            expiring_today: List[str] = []
            if today.weekday() == 1:   # Tuesday — NSE weekly expiry weekday
                for sym in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]:
                    try:
                        _, sym_upcoming = await get_expiry_dates_for_symbol(sym)
                        if sym_upcoming and _parse_nse_date(sym_upcoming) == today:
                            expiring_today.append(sym)
                    except Exception:
                        pass
        except Exception:
            all_dates      = []
            upcoming       = None
            expiring_today = []

        return {
            "date":              today.isoformat(),
            "dayOfWeek":         today.strftime("%A"),
            "isExpiryDay":       today.weekday() == 1,
            "upcomingExpiry":    upcoming,
            "expiryInstruments": expiring_today,
        }

    def all_states(self) -> List[Dict]:
        return [get_state(i).to_dict() for i in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]]

    def state(self, instrument: str) -> Dict:
        return get_state(instrument).to_dict()

    # ── schedule / start ─────────────────────────────────────────────────────

    async def schedule(self, instrument: str, paper: bool) -> Dict:
        """Schedule auto-entry at 10:30 AM."""
        st = get_state(instrument)
        with st._lock:
            if st.status in ("RUNNING", "EXITED"):
                return {"success": False, "message": f"Strategy already {st.status}.", **st.to_dict()}
            st.paper_mode = paper
            st.status     = "SCHEDULED"
            mode_label    = "PAPER" if paper else "LIVE"
            st._log("SCHEDULED", f"Strategy scheduled — {mode_label} mode. Entry at 10:30 AM.")
        return {"success": True, **st.to_dict()}

    async def start_now(self, instrument: str, paper: bool, angel: Optional[Dict] = None) -> Dict:
        """Enter the strategy immediately at current NSE prices."""
        st = get_state(instrument)
        with st._lock:
            if st.status == "RUNNING":
                return {"success": False, "message": "Already running.", **st.to_dict()}
            if st.status == "EXITED":
                return {"success": False, "message": "Exited today — reset first.", **st.to_dict()}
            st.paper_mode = paper
        return await self._enter(instrument, paper, angel)

    async def _enter(
        self,
        instrument: str,
        paper: bool,
        angel: Optional[Dict] = None,
    ) -> Dict:
        """
        Step 1: Fetch NSE option chain → pick 4 strikes (ONCE).
        Step 2: Resolve Angel One NFO tokens for each strike.
        Step 3: Mark strategy RUNNING.
        Price monitoring after this uses Angel One quote API only.
        """
        from services.nse_option_chain_service import get_chain_for_instrument
        from services.angel_option_service import resolve_tokens

        st = get_state(instrument)

        # ── Step 1: NSE chain (one call at entry) ────────────────────────────
        try:
            chain, expiry_str = await get_chain_for_instrument(instrument)
        except Exception as exc:
            err = str(exc)
            with st._lock:
                st._log("ERROR", f"NSE chain fetch failed: {err}")
            return {"success": False, "message": f"Could not fetch NSE option chain: {err}", **st.to_dict()}

        legs = build_legs(chain, instrument, expiry_str)
        if not legs:
            with st._lock:
                st._log("ERROR", "No suitable options found near target prices.")
            return {"success": False, "message": "No options found near ₹5 / ₹20.", **st.to_dict()}

        # ── Step 2: Resolve Angel One tokens ─────────────────────────────────
        resolve_tokens(legs)

        unresolved = [l["legId"] for l in legs if not l["angelToken"]]
        token_note = ""
        if unresolved:
            token_note = f" ⚠ Angel token missing for legs: {', '.join(unresolved)}"

        # ── Step 3: Mark RUNNING ──────────────────────────────────────────────
        mode_label = "PAPER (simulated ticks)" if paper else "LIVE (Angel One quotes)"
        with st._lock:
            st.legs       = legs
            st.status     = "RUNNING"
            st.paper_mode = paper
            st.expiry_str = expiry_str
            st.entry_time = datetime.now().strftime("%H:%M:%S")
            st._log(
                "ENTRY",
                (
                    f"Entered {len(legs)} legs — {mode_label} | "
                    f"Expiry: {expiry_str} | "
                    f"{len(chain)} options across "
                    f"{len(set(o['strike'] for o in chain))} strikes"
                    f"{token_note}"
                ),
            )
            for l in legs:
                st._log(
                    "OPEN",
                    (
                        f"{l['legId']} {l['action']} {l['optionType']} "
                        f"{l['tradingSymbol']}  "
                        f"entry=₹{l['entryPrice']:.2f}  "
                        f"SL=₹{l['slPrice']:.2f}  "
                        f"TGT={'₹'+str(l['tgtPrice']) if l['tgtPrice'] else '—'}  "
                        f"token={l['angelToken'] or 'UNRESOLVED'}"
                    ),
                    l["legId"],
                )

        return {"success": True, **st.to_dict()}

    # ── tick — price update + SL/TGT check ───────────────────────────────────

    async def tick(self, instrument: str, angel: Optional[Dict] = None) -> Dict:
        """
        Update prices for all open legs:
          • Paper mode  → simulate random-walk price
          • Live mode   → call Angel One quote API for real LTPs

        Also handles:
          • 10:30 auto-entry when status == SCHEDULED
          • 14:55 force-exit
        """
        from services.angel_option_service import fetch_option_ltps

        st = get_state(instrument)
        now_time        = datetime.now().time()
        entry_time      = dt_time(10, 30)
        force_exit_time = dt_time(14, 55)

        # Auto-enter if scheduled and past 10:30
        if st.status == "SCHEDULED" and now_time >= entry_time:
            return await self._enter(instrument, st.paper_mode, angel)

        if st.status != "RUNNING":
            return st.to_dict()

        # ── fetch live prices ─────────────────────────────────────────────────
        ltp_map: Dict[str, float] = {}

        if not st.paper_mode:
            # Live mode: Angel One quote API
            open_legs = [l for l in st.legs if l["status"] == "OPEN" and l.get("angelToken")]
            if open_legs and angel and angel.get("jwtToken"):
                try:
                    ltp_map = await fetch_option_ltps(angel, open_legs)
                except Exception as exc:
                    with st._lock:
                        st._log("WARN", f"Angel One quote error: {exc} — using last price")

        with st._lock:
            for leg in st.legs:
                if leg["status"] != "OPEN":
                    continue

                if st.paper_mode:
                    # Use tradingSymbol as stable key for sim state
                    new_price = simulate_tick(leg["tradingSymbol"], leg["entryPrice"])
                else:
                    token     = leg.get("angelToken", "")
                    new_price = ltp_map.get(token, leg["currentPrice"])

                closed = update_leg_price(leg, new_price)
                if closed:
                    st._log(
                        leg["status"],
                        (
                            f"{leg['legId']} {leg['action']} {leg['tradingSymbol']} "
                            f"closed @ ₹{new_price:.2f}  "
                            f"PnL ₹{leg['realizedPnl']:,.2f}"
                        ),
                        leg["legId"],
                    )

            # Force exit at 14:55
            if now_time >= force_exit_time:
                any_open = any(l["status"] == "OPEN" for l in st.legs)
                if any_open:
                    for leg in st.legs:
                        force_exit_leg(leg)
                    st.status    = "EXITED"
                    st.exit_time = datetime.now().strftime("%H:%M:%S")
                    st._log("FORCE_EXIT", "Force-exited all remaining positions at 14:55.")
                elif st.open_legs == 0:
                    st.status    = "EXITED"
                    st.exit_time = st.exit_time or datetime.now().strftime("%H:%M:%S")

        return st.to_dict()

    # ── manual exit ──────────────────────────────────────────────────────────

    async def exit_all(self, instrument: str) -> Dict:
        st = get_state(instrument)
        with st._lock:
            if st.status != "RUNNING":
                return {"success": False, "message": "Not running.", **st.to_dict()}
            for leg in st.legs:
                force_exit_leg(leg)
            st.status    = "EXITED"
            st.exit_time = datetime.now().strftime("%H:%M:%S")
            st._log("MANUAL_EXIT", "All positions manually closed.")
        return {"success": True, **st.to_dict()}

    # ── reset ─────────────────────────────────────────────────────────────────

    async def reset(self, instrument: str) -> Dict:
        with _reg_lock:
            _registry[instrument] = StrategyState(instrument)
        # Clear sim prices for this instrument
        for key in list(_sim_prices.keys()):
            if instrument in key:
                del _sim_prices[key]
        return {"success": True, "message": f"{instrument} reset.", **get_state(instrument).to_dict()}


# Singleton
expiry_options_service = ExpiryOptionsService()

# Made with Bob
