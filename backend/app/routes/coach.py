"""AI coach: teaches alpha writing. Explains, suggests experiments, reviews results.

Calls the Anthropic Messages API over httpx (no extra dependency). Needs ANTHROPIC_API_KEY;
without it the endpoints report the coach as disabled and the site keeps working.

Spend controls (all env-tunable, all in memory so they reset when the service restarts):
  COACH_PER_IP_DAILY   requests per visitor per UTC day            (default 15)
  COACH_GLOBAL_DAILY   requests across everyone per UTC day         (default 400)
  COACH_MONTHLY_USD    hard stop on estimated spend per UTC month   (default 10)
"""
from __future__ import annotations

import ast
import json
import logging
import os
import re
import threading
import time
from typing import Any, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..engine.alpha_dsl import ALLOWED_FUNCS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/coach", tags=["coach"])

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = os.getenv("COACH_MODEL", "claude-haiku-4-5-20251001")
PRICE_IN = float(os.getenv("COACH_PRICE_IN", "1.0"))    # USD per million input tokens
PRICE_OUT = float(os.getenv("COACH_PRICE_OUT", "5.0"))  # USD per million output tokens
PER_IP_DAILY = int(os.getenv("COACH_PER_IP_DAILY", "15"))
GLOBAL_DAILY = int(os.getenv("COACH_GLOBAL_DAILY", "400"))
MONTHLY_USD = float(os.getenv("COACH_MONTHLY_USD", "10"))
MAX_OUT_TOKENS = 1100

FIELDS = {
    "close", "open", "high", "low", "volume", "returns", "log_returns",
    "vwap", "range", "gap", "volume_ratio", "sector", "cap",
}

SYSTEM = """You are the coach inside lavaquant, a small quant research app. Your one job is to teach the user to design their own alphas and to think like a good quant. The user is a CS grad student, smart but new to alpha research. They explicitly do NOT want to depend on AI or the internet, so every reply should leave them more capable and less reliant on you.

Teaching rules:
- Explain WHY, not just what. The app already shows a mechanical step-by-step reading of the formula; add the economic idea, the failure modes, and the judgment a practitioner would bring.
- Prefer experiments over answers. Suggest one small change at a time, say what you expect to happen, and what each outcome would teach. Never promise that a change will improve results; say it is a hypothesis to test.
- When asked to write an alpha, first give a skeleton with blanks and the question each blank answers, so the user fills it in. If they say they are stuck or ask again, give the full expression with a line-by-line reason.
- Teach the habits: write the hypothesis before running, change one thing at a time, be suspicious of great results, check out-of-sample, mind turnover and costs, remember that 5 years of daily data is a noisy sample.
- Be honest about uncertainty. If a metric is within noise, say so. Do not flatter.
- Tone: dry, concise, plain words, no hype, no emoji. Short paragraphs. Define any jargon the first time.
- Stay on alpha research, quant concepts and this app. Otherwise reply in one sentence that you only coach alpha research.

The expression language (the ONLY thing you may use in suggested expressions):
- Fields: close, open, high, low, volume, returns, log_returns, vwap, range, gap, volume_ratio, sector, cap (cap is dollar volume, not market cap).
- Cross-sectional: rank(x) [-1..1], zscore(x), demean(x), winsorize(x, pct)
- Time-series (d is a whole number of trading days): ts_mean, ts_std, ts_sum, ts_max, ts_min, ts_delta, ts_delay, ts_rank, ts_decay_linear all as (x, d); ts_corr(x, y, d); ts_autocorr(x, lag, window)
- Group: group_rank(x, sector), group_zscore(x, sector), group_neutralize(x, sector)
- Element-wise: log, abs, sign, sqrt, power(x, n), clamp(x, lo, hi), max(x, y), min(x, y)
- Arithmetic: + - * / ** and parentheses. A leading minus flips the bet.
- The engine goes long the top 20% and short the bottom 20% of the score each day, equal weighted, and measures forward returns over the horizon the user chose.
- Metrics: IC = daily rank correlation of score and forward return (0.02 is decent). IC-IR = mean IC / std IC, daily (0.05-0.15 is realistic, >0.1 solid). Sharpe is annualized. Turnover is the share of the book traded per day.

Reply with a single JSON object and nothing else, with these keys:
{
  "reply": string,            // your teaching text, plain prose, at most ~170 words; use \\n\\n between paragraphs, no markdown headings or bullets
  "experiments": [            // 0 to 3 items; omit or [] if not useful
    {"title": string, "expression": string, "why": string, "predict": string}
  ],
  "concept": {"term": string, "plain": string} | null,   // one idea worth remembering from this exchange
  "check": string | null      // one question for the user to answer in their head before they run something
}
Every experiment expression must use only the language above and be a complete valid expression."""

MODE_TASK = {
    "explain": "Task: explain the user's alpha. Cover the hypothesis it encodes (the economic story), why each design choice makes sense or is questionable, what regime or situation would break it, and the one thing a practitioner would worry about first. Do not just restate the mechanical steps.",
    "next": "Task: coach the user on what to try next with this alpha. Give 2 or 3 single-change experiments. For each: the change, why it might help (the mechanism), what you predict, and what it would mean if the prediction is wrong. Order them from most to least informative.",
    "review": "Task: teach the user how to read this backtest. Say what is encouraging, what is weak or suspicious, and which numbers disagree with each other and why that matters. Be explicit about noise. End with the single most useful next experiment.",
    "ask": "Task: answer the user's question as a coach would. Follow the teaching rules, especially: skeleton before answer, and tie the answer back to how they could figure it out themselves next time.",
}


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class CoachRequest(BaseModel):
    mode: Literal["explain", "next", "review", "ask"]
    expression: str = Field("", max_length=600)
    question: str = Field("", max_length=500)
    forward_days: int = Field(5, ge=1, le=63)
    metrics: Optional[dict[str, float]] = None
    history: list[Turn] = Field(default_factory=list, max_length=6)


# ── Spend controls ───────────────────────────────────────────────────────────

_lock = threading.Lock()
_ip_hits: dict[tuple[str, str], int] = {}
_day_hits: dict[str, int] = {}
_month_spend: dict[str, float] = {}


def _day() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def _month() -> str:
    return time.strftime("%Y-%m", time.gmtime())


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _remaining(ip: str) -> int:
    used = _ip_hits.get((_day(), ip), 0)
    return max(0, PER_IP_DAILY - used)


def _enabled() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _check_and_count(ip: str) -> None:
    with _lock:
        if _month_spend.get(_month(), 0.0) >= MONTHLY_USD:
            raise HTTPException(429, "The coach has hit its monthly budget. It resets next month. The cheat sheet and Known alphas still work.")
        if _day_hits.get(_day(), 0) >= GLOBAL_DAILY:
            raise HTTPException(429, "The coach is busy today. Try again tomorrow.")
        if _ip_hits.get((_day(), ip), 0) >= PER_IP_DAILY:
            raise HTTPException(429, f"That's your {PER_IP_DAILY} coach questions for today. They reset at midnight UTC.")
        _ip_hits[(_day(), ip)] = _ip_hits.get((_day(), ip), 0) + 1
        _day_hits[_day()] = _day_hits.get(_day(), 0) + 1
        # forget old days so the dicts don't grow forever
        for k in [k for k in _ip_hits if k[0] != _day()]:
            del _ip_hits[k]


def _record_cost(usage: dict[str, Any]) -> None:
    cost = (usage.get("input_tokens", 0) * PRICE_IN + usage.get("output_tokens", 0) * PRICE_OUT) / 1_000_000
    with _lock:
        _month_spend[_month()] = _month_spend.get(_month(), 0.0) + cost


# ── Validation of suggested expressions ──────────────────────────────────────

def _valid_expression(expr: str) -> bool:
    if not expr or len(expr) > 300:
        return False
    try:
        tree = ast.parse(expr.strip(), mode="eval")
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in ALLOWED_FUNCS:
                return False
        elif isinstance(node, ast.Name):
            if node.id not in FIELDS and node.id not in ALLOWED_FUNCS:
                return False
        elif isinstance(node, (ast.BinOp, ast.UnaryOp, ast.Constant, ast.Load, ast.Expression)):
            continue
        elif isinstance(node, (ast.operator, ast.unaryop)):
            continue
        else:
            return False
    return True


def _parse_reply(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    data: dict[str, Any] = {}
    if m:
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            data = {}
    if not isinstance(data, dict) or "reply" not in data:
        return {"reply": text[:1200], "experiments": [], "concept": None, "check": None}

    exps = []
    for e in data.get("experiments") or []:
        if not isinstance(e, dict):
            continue
        expr = str(e.get("expression", "")).strip()
        if _valid_expression(expr):
            exps.append({
                "title": str(e.get("title", ""))[:80],
                "expression": expr,
                "why": str(e.get("why", ""))[:400],
                "predict": str(e.get("predict", ""))[:300],
            })
    concept = data.get("concept")
    if not (isinstance(concept, dict) and concept.get("term") and concept.get("plain")):
        concept = None
    else:
        concept = {"term": str(concept["term"])[:60], "plain": str(concept["plain"])[:300]}
    check = data.get("check")
    return {
        "reply": str(data["reply"])[:1600],
        "experiments": exps[:3],
        "concept": concept,
        "check": str(check)[:300] if check else None,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def status(request: Request) -> dict[str, Any]:
    ip = _client_ip(request)
    return {"enabled": _enabled(), "remaining": _remaining(ip) if _enabled() else 0, "daily_limit": PER_IP_DAILY}


def _user_message(req: CoachRequest) -> str:
    parts = [MODE_TASK[req.mode]]
    if req.expression.strip():
        parts.append(f"The user's alpha expression:\n{req.expression.strip()}")
        parts.append(f"Forward horizon: {req.forward_days} trading days.")
    else:
        parts.append("The user has not written an expression yet.")
    if req.metrics:
        pretty = ", ".join(f"{k}={v:.4g}" for k, v in req.metrics.items())
        parts.append(f"Latest backtest on a US large-cap sample (gross of costs): {pretty}")
    if req.question.strip():
        parts.append(f"The user's question:\n{req.question.strip()}")
    return "\n\n".join(parts)


@router.post("")
async def coach(req: CoachRequest, request: Request) -> dict[str, Any]:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(503, "The coach isn't switched on for this deployment.")
    if req.mode == "ask" and not req.question.strip():
        raise HTTPException(422, "Ask a question first.")
    if req.mode in ("explain", "next", "review") and not req.expression.strip():
        raise HTTPException(422, "Write an expression first so there's something to coach.")

    ip = _client_ip(request)
    _check_and_count(ip)

    messages = [{"role": t.role, "content": t.content} for t in req.history]
    messages.append({"role": "user", "content": _user_message(req)})
    # the API needs the first message to be from the user
    while messages and messages[0]["role"] != "user":
        messages.pop(0)

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                API_URL,
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": MODEL, "max_tokens": MAX_OUT_TOKENS, "system": SYSTEM, "messages": messages},
            )
    except httpx.HTTPError as e:
        logger.warning("coach upstream error: %s", e)
        raise HTTPException(502, "Couldn't reach the coach. Try again in a moment.")

    if resp.status_code != 200:
        logger.warning("coach upstream %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(502, "The coach had a problem. Try again in a moment.")

    body = resp.json()
    _record_cost(body.get("usage", {}))
    text = "".join(b.get("text", "") for b in body.get("content", []) if b.get("type") == "text")
    out = _parse_reply(text)
    out["remaining"] = _remaining(ip)
    return out
