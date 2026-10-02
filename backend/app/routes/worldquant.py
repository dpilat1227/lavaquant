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
MAX_POLLS = 24      # 24 × 5s = 120s timeout


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


async def _authenticate(client: httpx.AsyncClient, username: str, password: str) -> dict[str, str]:
    resp = await client.post(
        f"{WQ_BASE}/authentication",
        json={"username": username, "password": password},
        timeout=20.0,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=401, detail="WorldQuant authentication failed — check your email and password")
    return dict(resp.cookies)


async def _submit(client: httpx.AsyncClient, cookies: dict[str, str], req: WQSimRequest) -> tuple[str, dict[str, Any]]:
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

    resp = await client.post(
        f"{WQ_BASE}/alphas",
        json=payload,
        cookies=cookies,
        timeout=30.0,
    )

    if resp.status_code not in (200, 201):
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text[:400]
        raise HTTPException(status_code=400, detail=f"Simulation rejected: {detail}")

    data = resp.json()
    alpha_id = data.get("id") or (data.get("alpha") or {}).get("id", "")
    return alpha_id, data


async def _poll(client: httpx.AsyncClient, cookies: dict[str, str], alpha_id: str) -> dict[str, Any] | None:
    for _ in range(MAX_POLLS):
        await asyncio.sleep(POLL_INTERVAL)
        resp = await client.get(
            f"{WQ_BASE}/alphas/{alpha_id}",
            cookies=cookies,
            timeout=15.0,
        )
        if resp.status_code != 200:
            logger.warning("WQ poll returned %d for alpha %s", resp.status_code, alpha_id)
            continue

        data = resp.json()
        status = data.get("status", "")

        if status in ("ERROR", "FAILURE", "UNSUBMITTED"):
            msg = data.get("message") or data.get("error") or status
            raise HTTPException(status_code=400, detail=f"WQ simulation {status}: {msg}")

        if status == "DONE" or data.get("is"):
            return data

    return None  # timed out


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
            cookies = await _authenticate(client, req.username, req.password)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Could not reach WorldQuant API: {e}")

        alpha_id, initial_data = await _submit(client, cookies, req)

        if not alpha_id:
            return {"status": "submitted", "alpha_id": None, "metrics": None}

        completed = await _poll(client, cookies, alpha_id)

        if completed is None:
            return {"status": "pending", "alpha_id": alpha_id, "metrics": None}

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
