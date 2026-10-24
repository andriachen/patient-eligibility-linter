"""P3: Data loading for the app. Loads data/processed/, falls back to app/mock/."""

from pathlib import Path

import pandas as pd

PROCESSED = Path(__file__).resolve().parents[1] / "data" / "processed"
MOCK = Path(__file__).resolve().parent / "mock"


def load_csv(name: str) -> pd.DataFrame:
    """Load a processed CSV by filename, falling back to the mock copy."""
    processed_path = PROCESSED / name
    if processed_path.exists():
        return pd.read_csv(processed_path)
    mock_path = MOCK / name
    if mock_path.exists():
        return pd.read_csv(mock_path)
    return pd.DataFrame()
