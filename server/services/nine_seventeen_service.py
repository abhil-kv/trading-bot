"""
9:17 Buying Options Strategy Service

Strategy rules:
  ┌─ Scan (once at 09:17 or on "Start Trade") ─────────────────────────────────┐
  │  1. Fetch NIFTY option chain from NSE                                       │
  │  2. Find the CE strike whose LTP is closest to ₹140                        │
  │  3. Find the PE strike whose LTP is closest to ₹140                        │
  │  4. Lock both prices as "lockedPrice" — these become the reference base     │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─ Entry condition (checked every tick after lock) ──────────────────────────┐
  │  • India VIX must be between 10 and 50 (inclusive)                         │
  │  • Current day must NOT be Monday                                           │
  │  • For each leg (CE and PE independently):                                  │
  │      - Wait & Trade: currentLTP >= lockedPrice * 1.115  (up 11.5%)         │
  │      - Once condition is met → enter at current LTP                         │
  │      - SL  = lockedPrice * 0.20  (20% of locked price, absolute value)     │
  │      - TGT = lockedPrice * 2.00  (100% of locked price → doubles)          │
  └─────────────────────────────────────────────────────────────────────────────┘

  Force exit: 15:28 PM (all open positions closed before 15:29)

  Paper mode: simulated tick prices when no Angel One session present.
  Live  mode: Angel One Quote API (NFO) for LTPs.
"""

from __future__ import annotations

import random
import threading
from datetime import date, datetime, time as dt_time
from typing import Dict, List, Optional

from services.expiry_options_service import LOT_SIZES   # reuse lot-size table

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

TARGET_LTP       = 140.0   # ₹ — find option closest to this price at 09:17
WT_PCT           = 0.115   # 11.5% above locked price → Wait-and-Trade trigger
SL_PCT           = 0.20    # SL is 20% below locked price → lockedPrice × (1 − 0.20)
TGT_PCT          = 1.00    # 100% above locked price → lockedPrice × (1 + 1.00)
VIX_MIN          = 10.0
VIX_MAX          = 50.0
FORCE_EXIT_TIME  = dt_time(15, 28)
SCAN_TIME        = dt_time(9, 17)
LOTS_PER_LEG     = 1       # 1 lot per leg as per strategy spec


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _pick_nearest_to_140(chain: List[Dict], opt_type: str) -> Optional[Dict]:
    """Return the option (CE or PE) whose LTP is closest to ₹140."""
    candidates = [o for o in chain if o["type"] == opt_type and (o.get("ltp") or 0) > 0]
    return min(candidates, key=lambda o: abs(o["ltp"] - TARGET_LTP)) if candidates else None


def _build_leg(opt: Dict, opt_type: str, instrument: str, expiry_str: str) -> Dict:
    """Build a single leg dict from the NSE option row."""
    lot   = LOT_SIZES.get(instrument, 25)
    qty   = LOTS_PER_LEG * lot
    ep    = opt["ltp"]  # locked price

    # Pre-compute the thresholds:
    wt_trigger = round(ep * (1 + WT_PCT),  2)   # 11.5% above locked → W&T entry trigger
    sl_price   = round(ep * (1 - SL_PCT),  2)   # SL is 20% BELOW locked: locked × 0.80
    tgt_price  = round(ep * (1 + TGT_PCT), 2)   # 100% ABOVE locked: price doubles

    return {
        "legId":         f"L{1 if opt_type == 'CE' else 2}",
        "action":        "BUY",
        "optionType":    opt_type,
        "strike":        opt["strike"],
        "tradingSymbol": opt["tradingSymbol"],
        "expiry":        expiry_str,
        "underlying":    opt.get("underlying"),
        "lotSize":       lot,
        "lots":          LOTS_PER_LEG,
        "quantity":      qty,
        # Locked price (set at 09:17)
        "lockedPrice":   ep,
        # Wait-and-Trade trigger
        "wtTrigger":     wt_trigger,
        # Prices populated when entry fires
        "entryPrice":    None,
        "currentPrice":  ep,
        "slPrice":       sl_price,
        "tgtPrice":      tgt_price,
        # Status tracking
        "status":        "WATCHING",  # WATCHING | OPEN | SL_HIT | TGT_HIT | EXITED
        "phase":         "WAITING",   # WAITING (for WT trigger) | ACTIVE
        "realizedPnl":   0.0,
        "unrealizedPnl": 0.0,
        # Resolved by angel_option_service
        "angelSymbol":   "",
        "angelToken":    "",
    }


# ──────────────────────────────────────────────────────────────────────────────
# P&L helpers
# ──────────────────────────────────────────────────────────────────────────────

def _unrealized(leg: Dict) -> float:
    ep = leg.get("entryPrice") or 0
    cp = leg.get("currentPrice") or ep
    qty = leg["quantity"]
    return round((cp - ep) * qty, 2)


def _update_leg_price(leg: Dict, new_price: float) -> bool:
    """
    Update price for an OPEN leg; check SL/TGT.
    Returns True if the leg just closed.
    """
    if leg["status"] != "OPEN":
        return False

    new_price = max(round(new_price, 2), 0.05)
    leg["currentPrice"]  = new_price
    leg["unrealizedPnl"] = _unrealized(leg)

    ep  = leg["entryPrice"]
    qty = leg["quantity"]

    # Stop-loss check (absolute price, not %)
    if new_price <= leg["slPrice"]:
        leg["status"]        = "SL_HIT"
        leg["realizedPnl"]   = round((new_price - ep) * qty, 2)
        leg["unrealizedPnl"] = 0.0
        return True

    # Target check
    if new_price >= leg["tgtPrice"]:
        leg["status"]        = "TGT_HIT"
        leg["realizedPnl"]   = round((new_price - ep) * qty, 2)
        leg["unrealizedPnl"] = 0.0
        return True

    return False


def _force_exit_leg(leg: Dict):
    """Close any OPEN or WATCHING leg at current price (time-based exit at 15:28)."""
    if leg["status"] in ("OPEN", "WATCHING"):
        leg["status"]        = "EXITED"
        if leg["entryPrice"] is not None:
            leg["realizedPnl"]   = _unrealized(leg)
        leg["unrealizedPnl"] = 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Paper-mode price simulation
# ──────────────────────────────────────────────────────────────────────────────

_sim_prices: Dict[str, float] = {}


def _simulate_tick(token: str, base: float) -> float:
    last   = _sim_prices.get(token, base)
    change = random.uniform(-0.06, 0.08)  # slight upward bias to eventually trigger
    new    = max(0.05, last * (1 + change))
    _sim_prices[token] = new
    return round(new, 2)


# ──────────────────────────────────────────────────────────────────────────────
# Strategy state
# ──────────────────────────────────────────────────────────────────────────────

class NineSeventeenState:
    """Thread-safe state for one run of the 9:17 strategy."""

    def __init__(self):
        self.run_date    = date.today()
        self.status      = "IDLE"       # IDLE | SCANNING | LOCKED | RUNNING | EXITED
        self.paper_mode  = True
        self.expiry_str: Optional[str] = None
        self.scan_time:  Optional[str] = None
        self.entry_time: Optional[str] = None
        self.exit_time:  Optional[str] = None
        self.legs:       List[Dict]    = []
        self.log:        List[Dict]    = []
        self.india_vix:  Optional[float] = None   # populated each tick if available
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

    @property
    def watching_legs(self) -> int:
        return sum(1 for l in self.legs if l["status"] == "WATCHING")

    # ── serialisation ────────────────────────────────────────────────────────

    def to_dict(self) -> Dict:
        with self._lock:
            return {
                "runDate":         self.run_date.isoformat(),
                "status":          self.status,
                "paperMode":       self.paper_mode,
                "expiryStr":       self.expiry_str,
                "scanTime":        self.scan_time,
                "entryTime":       self.entry_time,
                "exitTime":        self.exit_time,
                "legs":            list(self.legs),
                "log":             list(self.log),
                "indiaVix":        self.india_vix,
                "openLegs":        self.open_legs,
                "watchingLegs":    self.watching_legs,
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
# Global registry (single NIFTY instance — strategy only runs on NIFTY)
# ──────────────────────────────────────────────────────────────────────────────

_state: Optional[NineSeventeenState] = None
_reg_lock = threading.Lock()


def get_state() -> NineSeventeenState:
    global _state
    with _reg_lock:
        today = date.today()
        if _state is None or _state.run_date != today:
            _state = NineSeventeenState()
        return _state


# ──────────────────────────────────────────────────────────────────────────────
# Service
# ──────────────────────────────────────────────────────────────────────────────

class NineSeventeenService:

    # ── state ─────────────────────────────────────────────────────────────────

    def state(self) -> Dict:
        return get_state().to_dict()

    # ── start / scan ──────────────────────────────────────────────────────────

    async def start_trade(self, paper: bool, angel: Optional[Dict] = None) -> Dict:
        """
        Trigger the 09:17 scan immediately (or schedule it if called before 09:17).
        Fetches NIFTY option chain, locks CE and PE strikes nearest to ₹140.
        """
        st = get_state()
        with st._lock:
            if st.status in ("LOCKED", "RUNNING"):
                return {"success": False, "message": "Already running — reset first.", **st.to_dict()}
            if st.status == "EXITED":
                return {"success": False, "message": "Exited today — reset first.", **st.to_dict()}
            st.paper_mode = paper

        return await self._scan_and_lock(paper, angel)

    async def _scan_and_lock(self, paper: bool, angel: Optional[Dict] = None) -> Dict:
        """Fetch option chain, pick the two ~₹140 strikes, lock them."""
        from services.nse_option_chain_service import get_chain_for_instrument
        from services.angel_option_service import resolve_tokens

        st = get_state()

        # ── Guard: not Monday ─────────────────────────────────────────────────
        if date.today().weekday() == 0:  # 0 = Monday
            with st._lock:
                st._log("BLOCKED", "Strategy does not trade on Mondays. Blocked.")
            return {"success": False, "message": "Strategy does not trade on Mondays.", **st.to_dict()}

        # ── Fetch NSE option chain ────────────────────────────────────────────
        try:
            chain, expiry_str = await get_chain_for_instrument("NIFTY")
        except Exception as exc:
            err = str(exc)
            with st._lock:
                st._log("ERROR", f"NSE chain fetch failed: {err}")
            return {"success": False, "message": f"Could not fetch NSE option chain: {err}", **st.to_dict()}

        # ── Pick strikes closest to ₹140 ──────────────────────────────────────
        ce_opt = _pick_nearest_to_140(chain, "CE")
        pe_opt = _pick_nearest_to_140(chain, "PE")

        if ce_opt is None or pe_opt is None:
            with st._lock:
                st._log("ERROR", "Could not find CE/PE strikes near ₹140 in the option chain.")
            return {"success": False, "message": "No options found near ₹140.", **st.to_dict()}

        legs = [
            _build_leg(ce_opt, "CE", "NIFTY", expiry_str),
            _build_leg(pe_opt, "PE", "NIFTY", expiry_str),
        ]

        # ── Resolve Angel One tokens ──────────────────────────────────────────
        resolve_tokens(legs)

        # ── Commit state ──────────────────────────────────────────────────────
        mode_label  = "PAPER" if paper else "LIVE"
        unresolved  = [l["legId"] for l in legs if not l["angelToken"]]
        token_note  = (f" ⚠ Angel token missing: {', '.join(unresolved)}") if unresolved else ""

        with st._lock:
            st.legs       = legs
            st.status     = "LOCKED"
            st.paper_mode = paper
            st.expiry_str = expiry_str
            st.scan_time  = datetime.now().strftime("%H:%M:%S")
            st._log(
                "LOCKED",
                (
                    f"Prices locked at 09:17 — {mode_label} mode | "
                    f"Expiry: {expiry_str} | "
                    f"CE strike {ce_opt['strike']} @ ₹{ce_opt['ltp']:.2f} | "
                    f"PE strike {pe_opt['strike']} @ ₹{pe_opt['ltp']:.2f}"
                    f"{token_note}"
                ),
            )
            for leg in legs:
                st._log(
                    "WATCH",
                    (
                        f"{leg['legId']} {leg['optionType']} {leg['tradingSymbol']} | "
                        f"Locked=₹{leg['lockedPrice']:.2f} | "
                        f"W&T trigger=₹{leg['wtTrigger']:.2f} (+11.5%) | "
                        f"SL=₹{leg['slPrice']:.2f} (−20% of locked) | "
                        f"TGT=₹{leg['tgtPrice']:.2f} (+100% of locked)"
                    ),
                    leg["legId"],
                )

        return {"success": True, **st.to_dict()}

    # ── tick — price update + entry/SL/TGT check ─────────────────────────────

    async def tick(self, angel: Optional[Dict] = None) -> Dict:
        """
        Called every ~3 seconds by the client.

        1. If status == LOCKED/RUNNING: fetch live LTPs.
        2. If status == LOCKED: check W&T trigger for each WATCHING leg.
           - If triggered AND conditions met (VIX 10-50, not Monday) → enter leg.
        3. If status == RUNNING: check SL/TGT for OPEN legs.
        4. At 15:28: force-exit all positions.
        5. Auto-scan at 09:17 if status == IDLE.
        """
        from services.angel_option_service import fetch_option_ltps

        st       = get_state()
        now_time = datetime.now().time()
        today    = date.today()

        # Auto-trigger scan at 09:17 when IDLE
        if st.status == "IDLE" and now_time >= SCAN_TIME:
            return await self._scan_and_lock(st.paper_mode, angel)

        if st.status not in ("LOCKED", "RUNNING"):
            return st.to_dict()

        # ── Fetch VIX if possible ─────────────────────────────────────────────
        await self._refresh_vix(st)

        # ── Fetch live LTPs ───────────────────────────────────────────────────
        ltp_map:    Dict[str, float] = {}
        has_session = bool(angel and angel.get("jwtToken") and angel.get("apiKey"))

        if has_session:
            open_legs = [
                l for l in st.legs
                if l["status"] in ("OPEN", "WATCHING") and l.get("angelToken")
            ]
            if open_legs:
                try:
                    ltp_map = await fetch_option_ltps(angel, open_legs)
                except Exception as exc:
                    with st._lock:
                        st._log("WARN", f"Angel One LTP fetch error: {exc} — holding last price")

        with st._lock:
            is_monday = today.weekday() == 0
            vix_ok    = (
                st.india_vix is not None
                and VIX_MIN <= st.india_vix <= VIX_MAX
            )

            for leg in st.legs:
                if leg["status"] not in ("OPEN", "WATCHING"):
                    continue

                token = leg.get("angelToken", "")

                # ── Determine new price ───────────────────────────────────────
                if token and token in ltp_map:
                    new_price = ltp_map[token]
                elif not has_session:
                    new_price = _simulate_tick(leg["tradingSymbol"], leg["currentPrice"])
                else:
                    new_price = leg["currentPrice"]

                new_price = max(round(new_price, 2), 0.05)
                leg["currentPrice"] = new_price

                # ── WATCHING: check W&T trigger ───────────────────────────────
                if leg["status"] == "WATCHING":
                    if new_price >= leg["wtTrigger"] and not is_monday and vix_ok:
                        # Enter this leg now
                        leg["status"]      = "OPEN"
                        leg["phase"]       = "ACTIVE"
                        leg["entryPrice"]  = new_price
                        leg["unrealizedPnl"] = 0.0
                        # Recalculate SL/TGT based on lockedPrice (not entry)
                        # (SL and TGT are already set from lockedPrice at build time)
                        st._log(
                            "ENTRY",
                            (
                                f"{leg['legId']} BUY {leg['optionType']} entered @ ₹{new_price:.2f} | "
                                f"W&T hit (+11.5% of locked ₹{leg['lockedPrice']:.2f}) | "
                                f"SL=₹{leg['slPrice']:.2f} | TGT=₹{leg['tgtPrice']:.2f}"
                            ),
                            leg["legId"],
                        )

                        # Mark strategy RUNNING once at least one leg is entered
                        if st.status == "LOCKED":
                            st.status     = "RUNNING"
                            st.entry_time = datetime.now().strftime("%H:%M:%S")

                    elif new_price >= leg["wtTrigger"] and (is_monday or not vix_ok):
                        # Trigger met but conditions failed
                        reasons = []
                        if is_monday:      reasons.append("Monday")
                        if not vix_ok:     reasons.append(f"VIX={st.india_vix} out of range [{VIX_MIN}–{VIX_MAX}]")
                        st._log(
                            "BLOCKED",
                            f"{leg['legId']} W&T trigger met but entry blocked: {', '.join(reasons)}",
                            leg["legId"],
                        )

                    continue  # No SL/TGT for WATCHING legs

                # ── OPEN: check SL/TGT ────────────────────────────────────────
                closed = _update_leg_price(leg, new_price)
                if closed:
                    st._log(
                        leg["status"],
                        (
                            f"{leg['legId']} BUY {leg['optionType']} closed @ ₹{new_price:.2f} | "
                            f"PnL ₹{leg['realizedPnl']:,.2f}"
                        ),
                        leg["legId"],
                    )

            # ── Check if all legs done (RUNNING with 0 open) ──────────────────
            if st.status == "RUNNING" and st.open_legs == 0 and st.watching_legs == 0:
                st.status    = "EXITED"
                st.exit_time = datetime.now().strftime("%H:%M:%S")
                st._log("ALL_CLOSED", "All positions closed.")

            # ── Force exit at 15:28 ───────────────────────────────────────────
            if now_time >= FORCE_EXIT_TIME:
                any_active = any(l["status"] in ("OPEN", "WATCHING") for l in st.legs)
                if any_active:
                    for leg in st.legs:
                        _force_exit_leg(leg)
                    st.status    = "EXITED"
                    st.exit_time = datetime.now().strftime("%H:%M:%S")
                    st._log("FORCE_EXIT", "Force-exited all positions at 15:28 (before 15:29 cutoff).")
                elif st.status in ("LOCKED", "RUNNING"):
                    st.status    = "EXITED"
                    st.exit_time = st.exit_time or datetime.now().strftime("%H:%M:%S")

        return st.to_dict()

    # ── VIX refresh ───────────────────────────────────────────────────────────

    async def _refresh_vix(self, st: NineSeventeenState):
        """
        Try to fetch India VIX from the NSE indices endpoint.
        Silently ignores failures — strategy continues without VIX gate if fetch fails.
        """
        try:
            from services.nse_indices_service import get_indices
            indices = await get_indices()
            for idx in indices:
                if "VIX" in (idx.get("symbol", "") + idx.get("name", "")).upper():
                    vix_val = idx.get("value")
                    if vix_val is not None:
                        st.india_vix = float(vix_val)
                        return
            # VIX not in indices — try dedicated NSE endpoint
            await self._fetch_vix_direct(st)
        except Exception:
            pass  # Non-fatal — VIX gate just won't trigger

    async def _fetch_vix_direct(self, st: NineSeventeenState):
        """Fetch India VIX directly from NSE allIndices endpoint."""
        try:
            from services.nse_option_chain_service import _nse_session
            data = await _nse_session.get("/api/allIndices")
            for item in data.get("data", []):
                if "VIX" in item.get("index", "").upper():
                    vix_val = item.get("last")
                    if vix_val is not None:
                        st.india_vix = float(vix_val)
                        return
        except Exception:
            pass

    # ── manual exit ──────────────────────────────────────────────────────────

    async def exit_all(self) -> Dict:
        st = get_state()
        with st._lock:
            if st.status not in ("LOCKED", "RUNNING"):
                return {"success": False, "message": "Not active.", **st.to_dict()}
            for leg in st.legs:
                _force_exit_leg(leg)
            st.status    = "EXITED"
            st.exit_time = datetime.now().strftime("%H:%M:%S")
            st._log("MANUAL_EXIT", "All positions manually closed.")
        return {"success": True, **st.to_dict()}

    # ── reset ─────────────────────────────────────────────────────────────────

    async def reset(self) -> Dict:
        global _state
        with _reg_lock:
            _state = NineSeventeenState()
        for key in list(_sim_prices.keys()):
            del _sim_prices[key]
        return {"success": True, "message": "Strategy reset.", **get_state().to_dict()}


# Singleton
nine_seventeen_service = NineSeventeenService()

# Made with Bob
