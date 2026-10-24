"""P3: Map view of trial sites by county."""

import streamlit as st

from app import data


def render() -> None:
    st.subheader("Map")
    sites = data.load_csv("trial_sites.csv")
    if sites.empty:
        st.info("No site data available yet.")
        return
    if {"lat", "lon"}.issubset(sites.columns):
        st.map(sites.dropna(subset=["lat", "lon"]))
    else:
        st.dataframe(sites)
