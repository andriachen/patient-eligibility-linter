"""Try login and the profile questions without the main app.

Run from the repo root: python -m streamlit run accounts/demo.py
"""

import streamlit as st

import accounts

st.set_page_config(page_title="Accounts demo", layout="centered")
accounts.render_sidebar()
st.title("My profile")
accounts.render_profile()
