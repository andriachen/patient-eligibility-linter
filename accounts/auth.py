"""Email + password login in the sidebar. Logging in is optional."""

import streamlit as st
from supabase import AuthError

from accounts.client import get_client, is_configured

MIN_PASSWORD = 6  # Supabase's default minimum


def current_user() -> dict | None:
    """{"id", "email"} for the signed-in user, or None."""
    return st.session_state.get("user")


def _remember(user) -> None:
    st.session_state.user = {"id": user.id, "email": user.email}


def sign_in(email: str, password: str) -> str | None:
    """Returns an error message, or None on success."""
    try:
        res = get_client().auth.sign_in_with_password({"email": email, "password": password})
    except AuthError as exc:
        return exc.message
    _remember(res.user)
    return None


def sign_up(email: str, password: str) -> str | None:
    """Returns an error message, or None when the user is now signed in."""
    try:
        res = get_client().auth.sign_up({"email": email, "password": password})
    except AuthError as exc:
        return exc.message
    if res.session is None:
        # "Confirm email" is still on in the Supabase project.
        return "Check your inbox to confirm your email, then log in."
    _remember(res.user)
    return None


def sign_out() -> None:
    try:
        get_client().auth.sign_out()
    except AuthError:
        pass  # the local session is cleared below either way
    for key in [k for k in st.session_state if k == "user" or k.startswith("wiz_")]:
        del st.session_state[key]


def render_sidebar() -> None:
    """Login / sign-up forms, or who's signed in with a log-out button."""
    with st.sidebar:
        st.subheader("Your account")
        if not is_configured():
            st.caption("Accounts are off: add SUPABASE_URL and SUPABASE_ANON_KEY to .env.")
            return

        user = current_user()
        if user:
            st.write(f"Signed in as **{user['email']}**")
            st.button("Log out", on_click=sign_out, use_container_width=True)
            return

        st.caption("Optional. Log in to save your profile.")
        log_in_tab, sign_up_tab = st.tabs(["Log in", "Sign up"])
        with log_in_tab:
            _auth_form("login", "Log in", sign_in)
        with sign_up_tab:
            _auth_form("signup", "Create account", sign_up)


def _auth_form(key: str, label: str, action) -> None:
    with st.form(f"auth_{key}"):
        st.text_input("Email", key=f"auth_{key}_email")
        st.text_input("Password", type="password", key=f"auth_{key}_password")
        st.form_submit_button(label, on_click=_submit, args=(key, action), use_container_width=True)
    if f"auth_{key}_error" in st.session_state:
        st.error(st.session_state.pop(f"auth_{key}_error"))


def _submit(key: str, action) -> None:
    """Form callback: runs before the page redraws, so a login shows up straight away."""
    email = st.session_state[f"auth_{key}_email"].strip()
    password = st.session_state[f"auth_{key}_password"]
    if not email or len(password) < MIN_PASSWORD:
        st.session_state[f"auth_{key}_error"] = (
            f"Enter an email and a password of at least {MIN_PASSWORD} characters."
        )
        return
    error = action(email, password)
    if error:
        st.session_state[f"auth_{key}_error"] = error
