"""WorldQuant BRAIN API proxy — authenticates and submits alpha simulations."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/wq", tags=["worldquant"])

WQ_BASE = "https://api.worldquantbrain.com"
POLL_INTERVAL = 5   # seconds between status checks
MAX_POLLS = 40      # 40 × 5s = 200s timeout


class WQSimRequest(BaseModel):
    username: str
    password: str
    expression: str
    region: str = "USA"
    universe: str = "TOP3000"
    delay: int = 1
    decay: int = 0
    neutralization: str = "SUBINDUSTRY"
    truncation: float = 0.08


async def _authenticate(client: httpx.AsyncClient, username: str, password: str) -> None:
    """BRAIN logs in with HTTP Basic auth (not a JSON body). On success it sets a session cookie
    on the client, which every later request on this client then carries."""
    resp = await client.post(f"{WQ_BASE}/authentication", auth=(username.strip(), password), timeout=20.0)
    if resp.status_code in (200, 201):
        return
    if resp.status_code == 401 and "persona" in resp.headers.get("www-authenticate", "").lower():
        loc = resp.headers.get("location", "")
        link = loc if loc.startswith("http") else f"{WQ_BASE}{loc}"
        raise HTTPException(
            status_code=401,
            detail=f"Your login is right, but WorldQuant wants a biometric check first. Open {link} to finish it, then try again.",
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="WorldQuant rejected that email and password. Check both, and use the email you sign in to BRAIN with.")
    raise HTTPException(status_code=502, detail=f"WorldQuant login failed with status {resp.status_code}.")


async def _simulate(client: httpx.AsyncClient, req: WQSimRequest) -> tuple[str | None, bool]:
    """Start a simulation and wait for it. Returns (alpha_id, finished)."""
    payload: dict[str, Any] = {
        "type": "REGULAR",
        "settings": {
            "instrumentType": "EQUITY",
            "region": req.region,
            "universe": req.universe,
            "delay": req.delay,
            "decay": req.decay,
            "neutralization": req.neutralization,
            "truncation": req.truncation,
            "pasteurization": "ON",
            "unitHandling": "VERIFY",
            "nanHandling": "OFF",
            "language": "FASTEXPR",
            "visualization": False,
        },
        "regular": req.expression,
    }

    resp = await client.post(f"{WQ_BASE}/simulations", json=payload, timeout=30.0)
    if resp.status_code not in (200, 201):
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:400]
        raise HTTPException(status_code=400, detail=f"Simulation rejected: {detail}")

    location = resp.headers.get("location")
    if not location:
        raise HTTPException(status_code=502, detail="WorldQuant accepted the simulation but didn't say where to poll for it.")

    # While a simulation runs, the progress URL answers with a Retry-After header. When it's gone, we're done.
    for _ in range(MAX_POLLS):
        await asyncio.sleep(POLL_INTERVAL)
        prog = await client.get(location, timeout=15.0)
        wait = prog.headers.get("retry-after")
        if wait and float(wait) > 0:
            continue
        if prog.status_code != 200:
            continue
        data = prog.json()
        status = str(data.get("status", "")).upper()
        if status in ("ERROR", "FAIL", "FAILED"):
            raise HTTPException(status_code=400, detail=f"WQ simulation failed: {data.get('message') or status}")
        return data.get("alpha"), True
    return None, False


async def _fetch_alpha(client: httpx.AsyncClient, alpha_id: str) -> dict[str, Any]:
    resp = await client.get(f"{WQ_BASE}/alphas/{alpha_id}", timeout=20.0)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Simulation finished but the result couldn't be fetched (status {resp.status_code}).")
    return resp.json()


def _extract_metrics(data: dict[str, Any]) -> dict[str, Any]:
    is_data = data.get("is") or {}
    os_data = data.get("os") or {}
    return {
        "fitness":    is_data.get("fitness"),
        "sharpe":     is_data.get("sharpe"),
        "turnover":   is_data.get("turnover"),
        "returns":    is_data.get("returns"),
        "drawdown":   is_data.get("drawdown"),
        "margin":     is_data.get("margin"),
        "long_count": is_data.get("longCount"),
        "short_count": is_data.get("shortCount"),
        # out-of-sample if available
        "os_fitness": os_data.get("fitness"),
        "os_sharpe":  os_data.get("sharpe"),
    }


@router.post("/simulate")
async def wq_simulate(req: WQSimRequest) -> dict[str, Any]:
    """
    Proxy a WorldQuant BRAIN simulation.
    Credentials are used only for this request and never stored server-side.
    """
    async with httpx.AsyncClient() as client:
        try:
            await _authenticate(client, req.username, req.password)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Could not reach WorldQuant API: {e}")

        alpha_id, finished = await _simulate(client, req)
        if not finished or not alpha_id:
            return {"status": "pending", "alpha_id": alpha_id, "metrics": None}

        completed = await _fetch_alpha(client, alpha_id)
        return {
            "status": "done",
            "alpha_id": alpha_id,
            "metrics": _extract_metrics(completed),
            "settings": {
                "region": req.region,
                "universe": req.universe,
                "neutralization": req.neutralization,
                "delay": req.delay,
            },
        }
