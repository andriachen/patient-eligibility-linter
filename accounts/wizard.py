"""Profile wizard: one question per screen, saved to Supabase after every step.

Buttons use on_click callbacks, which run before the page is drawn, so each
click is handled in a single pass without st.rerun().
"""

import streamlit as st

from accounts import store
from accounts.auth import current_user
from accounts.client import is_configured
from accounts.questions import COUNTY_FIPS, OUTSIDE_MA, PATIENT_ROLES, Question, towns, visible_questions

ANSWERS = "wiz_answers"
STEP = "wiz_step"
MODE = "wiz_mode"  # questions | review | saved
EDITING = "wiz_editing"  # came from the review screen, so go back there when done
LOADED_FOR = "wiz_loaded_for"
ERROR = "wiz_error"
SAVE_ERROR = "wiz_save_error"


def render_profile() -> None:
    """The "My profile" tab. Asks the user to log in first."""
    if not is_configured():
        st.info("Accounts aren't set up yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.")
        return
    user = current_user()
    if user is None:
        st.info("Log in or sign up in the sidebar to build your profile. It takes about 2 minutes.")
        return
    if not _load(user["id"]):
        return
    if SAVE_ERROR in st.session_state:
        st.warning(f"Couldn't save to your account: {st.session_state[SAVE_ERROR]}")

    mode = st.session_state[MODE]
    if mode == "questions":
        _render_question(user["id"])
    elif mode == "review":
        _render_review(user["id"])
    else:
        _render_saved()


def _load(user_id: str) -> bool:
    """Pull any saved profile once per login. Returns False if it couldn't."""
    if st.session_state.get(LOADED_FOR) == user_id:
        return True
    try:
        row = store.load_profile(user_id)
    except Exception as exc:  # don't start a blank wizard over a profile we failed to read
        st.error(f"Couldn't load your profile: {exc}")
        return False

    answers = row["answers"] if row else {}
    questions = visible_questions(answers)
    unanswered = [i for i, q in enumerate(questions) if q.key not in answers and not q.optional]
    st.session_state[ANSWERS] = answers
    st.session_state[STEP] = unanswered[0] if unanswered else 0
    if row and row["completed"]:
        st.session_state[MODE] = "saved"
    else:
        st.session_state[MODE] = "questions" if unanswered else "review"
    st.session_state[LOADED_FOR] = user_id
    return True


# --- question screen ---

def _render_question(user_id: str) -> None:
    answers = st.session_state[ANSWERS]
    questions = visible_questions(answers)
    step = min(st.session_state[STEP], len(questions) - 1)
    q = questions[step]

    # The total isn't known until the role question picks a branch.
    total = f" of {len(questions)}" if "role" in answers else ""
    st.progress(step / len(questions), text=f"Question {step + 1}{total}")
    if answers.get("role") == "caregiver" and q.key != "role":
        st.caption("Answer for the person you're helping.")
    _input(q, answers.get(q.key))
    if ERROR in st.session_state:
        st.error(st.session_state.pop(ERROR))

    back, skip, next_ = st.columns(3)
    back.button("Back", disabled=step == 0, on_click=_go_to, args=(step - 1,), use_container_width=True)
    if q.optional:
        skip.button("Skip", on_click=_advance, args=(user_id, q, None), use_container_width=True)
    next_.button("Next", type="primary", on_click=_next, args=(user_id, q), use_container_width=True)


def _input(q: Question, current) -> None:
    """Draw the widget for one question, pre-filled with any saved answer."""
    st.subheader(q.prompt)
    if q.help:
        st.caption(q.help)
    key = _key(q)
    values = [v for v, _ in q.options]
    labels = dict(q.options)

    if q.kind == "single":
        st.radio(q.prompt, values, index=_index(values, current), format_func=labels.get,
                 key=key, label_visibility="collapsed")
    elif q.kind == "select":
        st.selectbox(q.prompt, values, index=_index(values, current), format_func=labels.get,
                     placeholder="Choose one", key=key, label_visibility="collapsed")
    elif q.kind == "multi":
        current = current or []
        columns = st.columns(2 if len(values) > 6 else 1)
        for i, v in enumerate(values):
            columns[i % len(columns)].checkbox(labels[v], value=v in current, key=f"{key}_{v}")
    elif q.kind == "number":
        st.number_input(q.prompt, min_value=q.min_value, max_value=q.max_value, value=current, step=1,
                        placeholder="Type a number", key=key, label_visibility="collapsed")
    elif q.kind == "text":
        st.text_area(q.prompt, value=current or "", key=key, label_visibility="collapsed")
    elif q.kind == "town":
        names = sorted(_county_by_town()) + [OUTSIDE_MA]
        st.selectbox(q.prompt, names, index=_index(names, current and current["town"]),
                     placeholder="Type your city or town", key=key, label_visibility="collapsed")
    elif q.kind == "body":
        current = current or {}
        height = current.get("height_in")
        feet, inches, weight = st.columns(3)
        feet.number_input("Height (feet)", min_value=3, max_value=8, step=1,
                          value=height // 12 if height else None, key=f"{key}_ft")
        inches.number_input("Inches", min_value=0, max_value=11, step=1,
                            value=height % 12 if height else None, key=f"{key}_in")
        weight.number_input("Weight (lb)", min_value=50, max_value=700, step=1,
                            value=current.get("weight_lb"), key=f"{key}_lb")
    else:
        raise ValueError(f"Unknown question kind: {q.kind}")


def _read(q: Question):
    """The answer currently entered in the question's widget, as it will be saved."""
    key = _key(q)
    state = st.session_state
    if q.kind == "multi":
        return [v for v, _ in q.options if state.get(f"{key}_{v}")]
    if q.kind == "text":
        return (state.get(key) or "").strip() or None
    if q.kind == "town":
        town = state.get(key)
        if town is None:
            return None
        county = _county_by_town().get(town)
        return {"town": town, "county": county, "county_fips": COUNTY_FIPS.get(county)}
    if q.kind == "body":
        feet, inches, weight = state.get(f"{key}_ft"), state.get(f"{key}_in"), state.get(f"{key}_lb")
        if feet is None or weight is None:
            return None
        height_in = feet * 12 + (inches or 0)
        return {"height_in": height_in, "weight_lb": weight, "bmi": round(703 * weight / height_in**2, 1)}
    return state.get(key)


def _key(q: Question) -> str:
    return f"wiz_q_{q.key}"


def _county_by_town() -> dict[str, str]:
    return towns() or {county: county for county in COUNTY_FIPS}


def _index(values: list, current) -> int | None:
    return values.index(current) if current in values else None


def _validate(q: Question, value) -> str | None:
    if value is None or value == []:
        return None if q.optional else "Please answer this one to continue."
    if q.kind == "multi" and "none" in value and len(value) > 1:
        return "“None of these” can't be picked along with other answers."
    return None


def _go_to(step: int) -> None:
    st.session_state[STEP] = step


def _next(user_id: str, q: Question) -> None:
    value = _read(q)
    error = _validate(q, value)
    if error:
        st.session_state[ERROR] = error
    else:
        _advance(user_id, q, value)


def _advance(user_id: str, q: Question, value) -> None:
    answers = st.session_state[ANSWERS]
    if value is None:
        answers.pop(q.key, None)
    else:
        answers[q.key] = value

    questions = visible_questions(answers)
    later = questions[[x.key for x in questions].index(q.key) + 1:]
    if st.session_state.get(EDITING):
        # Only stop at questions this change opened up, then go back to review.
        later = [x for x in later if x.key not in answers and not x.optional]
    if later:
        st.session_state[STEP] = questions.index(later[0])
    else:
        st.session_state[MODE] = "review"
        st.session_state[EDITING] = False
    _save(user_id, completed=False)


# --- review and saved screens ---

def _render_review(user_id: str) -> None:
    answers = st.session_state[ANSWERS]
    st.subheader("Check your answers")
    _summary(answers, editable=True)

    agreed = True
    if answers.get("role") in PATIENT_ROLES:
        agreed = st.checkbox("I understand my answers are saved to my account and used to "
                             "suggest trials. This isn't medical advice.")
    st.button("Save profile", type="primary", disabled=not agreed, on_click=_finish, args=(user_id,))


def _render_saved() -> None:
    st.success("Your profile is saved.")
    _summary(st.session_state[ANSWERS], editable=False)
    st.button("Edit answers", on_click=_set_mode, args=("review",))


def _summary(answers: dict, editable: bool) -> None:
    for i, q in enumerate(visible_questions(answers)):
        text, edit = st.columns([6, 1])
        text.markdown(f"**{q.prompt}**  \n{q.label(answers.get(q.key))}")
        if editable:
            edit.button("Edit", key=f"wiz_edit_{q.key}", on_click=_edit, args=(i,))


def _edit(step: int) -> None:
    st.session_state[STEP] = step
    st.session_state[MODE] = "questions"
    st.session_state[EDITING] = True


def _set_mode(mode: str) -> None:
    st.session_state[MODE] = mode


def _finish(user_id: str) -> None:
    answers = st.session_state[ANSWERS]
    # Drop answers left over from the other role's branch.
    st.session_state[ANSWERS] = {q.key: answers[q.key] for q in visible_questions(answers) if q.key in answers}
    if _save(user_id, completed=True):
        st.session_state[MODE] = "saved"


def _save(user_id: str, completed: bool) -> bool:
    try:
        store.save_profile(user_id, st.session_state[ANSWERS], completed)
    except Exception as exc:  # keep the answers in the session even if Supabase is unreachable
        st.session_state[SAVE_ERROR] = str(exc)
        return False
    st.session_state.pop(SAVE_ERROR, None)
    return True
