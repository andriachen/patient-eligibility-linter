"""P3: Interactive linter view."""

import streamlit as st

from pipeline.extract.lint import lint_criteria


def render() -> None:
    st.subheader("Eligibility criteria linter")
    text = st.text_area("Paste eligibility criteria text")
    if st.button("Lint") and text.strip():
        try:
            flags = lint_criteria(text)
        except NotImplementedError:
            st.warning("Linter not implemented yet.")
            return
        if not flags:
            st.success("No issues flagged.")
        else:
            st.dataframe(flags)
