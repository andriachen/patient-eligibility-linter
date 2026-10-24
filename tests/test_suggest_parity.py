"""Guards the hand-maintained sync between the Python and TypeScript suggestions.

`pipeline/extract/suggest.py` (`_SUGGESTIONS`) is the source of truth for the
per-category rewording suggestions + citations. The web Linter re-declares the
same table in `app/project-starter/lib/mockLint.ts` (`SUGGESTIONS`) with a
"Copied from ... (keep in sync)" comment, because the two apps don't share code.

There is no TypeScript test runner in the web app, so this Python test parses the
TS object literal and asserts it is byte-for-byte equal to the Python table:
same 13 categories, identical suggestion text, identical citation (empty string
for the 5 categories with no formal FDA/ASCO guidance). If this fails, someone
changed one side without the other.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from pipeline.extract.suggest import _SUGGESTIONS

ROOT = Path(__file__).resolve().parents[1]
MOCKLINT_TS = ROOT / "app" / "project-starter" / "lib" / "mockLint.ts"


def _parse_ts_suggestions(src: str) -> dict[str, tuple[str, str]]:
    """Extract the `SUGGESTIONS` object literal from mockLint.ts.

    Shape in the TS file:
        const SUGGESTIONS: Record<string, [string, string]> = {
          brain_mets: [
            "suggestion text",
            "citation",
          ],
          ...
        };
    We grab the braces block, then pull each `key: [ "a", "b" ]` entry.
    """
    start = src.index("const SUGGESTIONS")
    brace = src.index("{", start)
    # walk to the matching closing brace
    depth = 0
    end = brace
    for i in range(brace, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    block = src[brace : end + 1]

    out: dict[str, tuple[str, str]] = {}
    # key: [ "str", "str" ],  (strings may contain escaped quotes / apostrophes)
    entry = re.compile(
        r"(\w+)\s*:\s*\[\s*(\"(?:[^\"\\]|\\.)*\")\s*,\s*(\"(?:[^\"\\]|\\.)*\")\s*,?\s*\]",
        re.DOTALL,
    )
    for m in entry.finditer(block):
        key = m.group(1)
        text = ast.literal_eval(m.group(2))
        source = ast.literal_eval(m.group(3))
        out[key] = (text, source)
    return out


def test_mocklint_suggestions_match_python_source():
    ts = _parse_ts_suggestions(MOCKLINT_TS.read_text(encoding="utf-8"))

    # same set of categories
    assert set(ts) == set(_SUGGESTIONS), (
        "category mismatch between mockLint.ts and suggest.py: "
        f"only in TS={set(ts) - set(_SUGGESTIONS)}, "
        f"only in PY={set(_SUGGESTIONS) - set(ts)}"
    )

    # identical suggestion text and citation per category
    for cat, (py_text, py_source) in _SUGGESTIONS.items():
        ts_text, ts_source = ts[cat]
        assert ts_text == py_text, f"suggestion text drifted for {cat!r}"
        assert ts_source == py_source, f"suggestion_source drifted for {cat!r}"
