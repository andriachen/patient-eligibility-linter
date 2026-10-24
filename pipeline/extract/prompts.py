"""P2: System prompt + tool schema for eligibility-criteria extraction."""

SYSTEM_PROMPT = """You extract and classify clinical trial eligibility criteria.
Return structured output via the provided tool."""

# Tool schema passed to the Anthropic API for structured extraction.
EXTRACT_TOOL = {
    "name": "extract_criteria",
    "description": "Extract eligibility criteria as structured records.",
    "input_schema": {
        "type": "object",
        "properties": {
            "criteria": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "kind": {
                            "type": "string",
                            "enum": ["inclusion", "exclusion"],
                        },
                        "category": {"type": "string"},
                    },
                    "required": ["text", "kind"],
                },
            }
        },
        "required": ["criteria"],
    },
}
