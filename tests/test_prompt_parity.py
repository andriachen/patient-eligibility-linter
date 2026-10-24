"""Guards the sync between the pipeline's extraction prompt and the live Linter's copy.

`pipeline/extract/prompts.py` is the source of truth. The web Linter
(`app/project-starter/app/api/lint/route.ts`) sends the same prompt to the same
model, using a copy in `app/project-starter/lib/extraction/prompt.ts`, so a pasted
draft is read exactly like the 1,011 trials behind Landscape and Map. If this fails,
someone changed one side without the other (and the cache's PROMPT_VERSION).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from pipeline.extract.prompts import CATEGORIES, EXTRACT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT

ROOT = Path(__file__).resolve().parents[1]
PROMPT_TS = ROOT / "app" / "project-starter" / "lib" / "extraction" / "prompt.ts"


def _ts() -> str:
    return PROMPT_TS.read_text(encoding="utf-8")


def test_prompt_version_matches():
    match = re.search(r'export const PROMPT_VERSION = "([^"]+)";', _ts())
    assert match, "PROMPT_VERSION not found in prompt.ts"
    assert match.group(1) == PROMPT_VERSION


def test_categories_match():
    match = re.search(r"export const CATEGORIES = (\[.*?\]) as const;", _ts())
    assert match, "CATEGORIES not found in prompt.ts"
    assert json.loads(match.group(1)) == CATEGORIES


def test_system_prompt_matches():
    # Template literal; the prompt has no backticks, backslashes or ${ to escape.
    match = re.search(r"export const SYSTEM_PROMPT = `(.*?)`;", _ts(), re.S)
    assert match, "SYSTEM_PROMPT not found in prompt.ts"
    assert match.group(1) == SYSTEM_PROMPT


def test_tool_schema_matches():
    match = re.search(r"export const EXTRACT_TOOL = (\{.*\}) satisfies", _ts(), re.S)
    assert match, "EXTRACT_TOOL not found in prompt.ts"
    assert json.loads(match.group(1)) == EXTRACT_TOOL
