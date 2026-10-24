"""P2: Provider seam. The ONLY module that imports the Anthropic SDK.

Swapping to Bedrock/Gemini later means changing just this file. Everything else
in pipeline/extract/ depends on extract_raw() and the plain dicts it returns.
"""

from __future__ import annotations

import os
import time

from .prompts import CATEGORIES, EXTRACT_TOOL, SYSTEM_PROMPT

_VALID_CATEGORIES = set(CATEGORIES)

DEFAULT_MODEL = "claude-haiku-5-5"
MAX_TOKENS = 4096
MAX_RETRIES = 5
BACKOFF_BASE = 2.0
# A trial with at least this much criteria text that returns ZERO records is
# treated as suspicious (model read failure) and retried once.
LONG_CRITERIA_CHARS = 3000
# HTTP status codes worth retrying (transient). Everything else (400/401/403/404)
# is a permanent error we must NOT retry — doing so just burns time and hides the
# real cause (bad key, bad model id, malformed request).
RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}


class MissingKeyError(RuntimeError):
    """Raised when ANTHROPIC_API_KEY is not set."""


def _load_env() -> None:
    """Best-effort load of a local .env so ANTHROPIC_API_KEY is available."""
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except Exception:  # noqa: BLE001 - dotenv is optional at runtime
        pass


def _model() -> str:
    return os.environ.get("P2_MODEL") or DEFAULT_MODEL


_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    _load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise MissingKeyError(
            "ANTHROPIC_API_KEY is not set. Add it to .env or the environment."
        )
    import anthropic

    _client = anthropic.Anthropic()
    return _client


def extract_raw(text: str) -> list[dict]:
    """Call the model once and return the raw list of exclusion-record dicts.

    Forces the extract_exclusions tool, temperature 0. Retries with exponential
    backoff on rate-limit / transient errors. Returns [] if the model produced no
    tool call.
    """
    import anthropic

    client = _get_client()
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.messages.create(
                model=_model(),
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                tools=[EXTRACT_TOOL],
                tool_choice={"type": "tool", "name": EXTRACT_TOOL["name"]},
                messages=[{"role": "user", "content": text}],
                # NOTE: Haiku/Sonnet 5.5 reject a `temperature` param ("Extra inputs
                # are not permitted"). Determinism here comes from forced tool_choice
                # + a tightly-constrained schema, not a sampling temperature.
            )
            records, stop_reason, had_tool = _parse(resp)
            # A long trial that returns NOTHING is suspicious — the model almost
            # always finds >=1 restriction in dense oncology criteria. Retry once
            # (one more attempt) and log why it came back thin.
            if not records and len(text) >= LONG_CRITERIA_CHARS and attempt == 0:
                import sys
                print(
                    f"  WARNING: empty result on {len(text)}-char criteria "
                    f"(stop_reason={stop_reason!r}, tool_block={had_tool}); retrying once.",
                    file=sys.stderr,
                )
                continue  # re-call
            return records
        except anthropic.APIConnectionError as err:
            last_err = err  # network blip — retry
        except anthropic.APIStatusError as err:
            # Only retry transient status codes; fail fast on 4xx (bad key / model
            # / request) so we don't waste calls or hide the real error.
            if getattr(err, "status_code", None) not in RETRYABLE_STATUS:
                raise
            last_err = err
        time.sleep(BACKOFF_BASE**attempt)
    raise RuntimeError(f"extract_raw failed after {MAX_RETRIES} attempts: {last_err}")


def _parse(resp) -> tuple[list[dict], str | None, bool]:
    """Pull exclusions out of the tool-use block.

    Returns (records, stop_reason, had_tool_block) so the caller can tell a
    genuinely-empty extraction from a read failure.

    Handles a quirk where the model occasionally returns `exclusions` as a JSON
    STRING (the whole array serialized) instead of a native list. Warns if the
    response was truncated by max_tokens so partial JSON doesn't pass silently.
    """
    import json
    import sys

    stop_reason = getattr(resp, "stop_reason", None)
    if stop_reason == "max_tokens":
        print(
            "  WARNING: response hit max_tokens; tool output may be truncated.",
            file=sys.stderr,
        )
    for block in resp.content:
        if getattr(block, "type", None) != "tool_use":
            continue
        payload = block.input or {}
        items = payload.get("exclusions", [])
        # Occasionally the model serializes the whole array as a string.
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except (ValueError, TypeError):
                return [], stop_reason, True
        if not isinstance(items, list):
            return [], stop_reason, True
        # Keep only well-formed dict records with a VALID category. The model
        # occasionally invents one (e.g. "bilirubin_placeholder") — drop it here.
        clean = []
        for it in items:
            if not isinstance(it, dict):
                continue
            if it.get("category") not in _VALID_CATEGORIES:
                print(
                    f"  WARNING: dropping invalid category {it.get('category')!r}",
                    file=sys.stderr,
                )
                continue
            clean.append(dict(it))
        return clean, stop_reason, True
    # No tool_use block at all.
    return [], stop_reason, False


def model_name() -> str:
    """Expose the resolved model id (for cache provenance)."""
    return _model()
