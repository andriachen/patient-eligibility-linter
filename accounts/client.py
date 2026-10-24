"""Supabase client, one per browser session so logins never leak between users."""

import os
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def is_configured() -> bool:
    """True when .env (or Streamlit secrets) has the Supabase URL and anon key."""
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"))


def get_client() -> Client:
    """Return this browser session's client.

    Don't swap this for st.cache_resource: a cached client is shared by every
    visitor, so one person's login would be used for everyone's requests.
    """
    if "sb_client" not in st.session_state:
        st.session_state.sb_client = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"]
        )
    return st.session_state.sb_client
