"""P3: Trial landscape view."""

import streamlit as st

from app import data


def render() -> None:
    st.subheader("Trial landscape")
    trials = data.load_csv("trials.csv")
    if trials.empty:
        st.info("No trial data available yet.")
        return
    st.dataframe(trials)
