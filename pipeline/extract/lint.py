"""P2: Rule-based linter for eligibility criteria text."""


def lint_criteria(text: str) -> list[dict]:
    """Return a list of flagged criteria.

    Each dict has at least: {"category": str, "text": str}.
    """
    raise NotImplementedError("lint_criteria: implement lint rules")
