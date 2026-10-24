"""P3: Streamlit entrypoint. Run with `streamlit run app/main.py`."""

import streamlit as st

from app.components import landscape, linter, map_view


def main() -> None:
    st.set_page_config(page_title="Hackachusetts Trial Linter", layout="wide")
    st.title("Hackachusetts Trial Linter")

    tab_landscape, tab_map, tab_linter = st.tabs(["Landscape", "Map", "Linter"])

    with tab_landscape:
        landscape.render()
    with tab_map:
        map_view.render()
    with tab_linter:
        linter.render()


if __name__ == "__main__":
    main()
