"""Profile questions. The first one picks the role; the rest branch on it.

Saved answers are {question key: option value}. Values are stable codes for
matching; labels are only for display. Health conditions use the README
category names (diabetes, renal, hepatic, ...) so they line up with
exclusions.csv.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import pandas as pd

TOWNS_CSV = Path(__file__).resolve().parents[1] / "data" / "processed" / "ma_town_county.csv"
OUTSIDE_MA = "Outside Massachusetts"

COUNTY_FIPS = {
    "Barnstable": "25001", "Berkshire": "25003", "Bristol": "25005", "Dukes": "25007",
    "Essex": "25009", "Franklin": "25011", "Hampden": "25013", "Hampshire": "25015",
    "Middlesex": "25017", "Nantucket": "25019", "Norfolk": "25021", "Plymouth": "25023",
    "Suffolk": "25025", "Worcester": "25027",
}

CANCER_TYPES = (
    ("breast", "Breast"),
    ("lung", "Lung"),
    ("colorectal", "Colon or rectal"),
    ("prostate", "Prostate"),
    ("blood", "Blood cancer (leukemia, lymphoma, myeloma)"),
    ("skin", "Melanoma or other skin cancer"),
    ("pancreatic", "Pancreatic"),
    ("gynecologic", "Ovarian, uterine or cervical"),
    ("brain", "Brain or spinal cord"),
    ("kidney_bladder", "Kidney or bladder"),
    ("head_neck", "Head and neck"),
    ("liver_stomach", "Liver, stomach or esophagus"),
    ("other", "Other"),
)

PATIENT_ROLES = ("patient", "caregiver")


@dataclass(frozen=True)
class Question:
    key: str
    prompt: str
    kind: str  # single | select | multi | number | text | town | body
    options: tuple = ()  # (value, label) pairs
    help: str = ""
    optional: bool = False
    show_if: Callable[[dict], bool] = field(default=lambda answers: True)
    min_value: int | None = None
    max_value: int | None = None

    def label(self, value) -> str:
        """Human-readable version of a saved answer."""
        if value is None or value == [] or value == "":
            return "Skipped"
        labels = dict(self.options)
        if self.kind == "multi":
            return ", ".join(labels.get(v, v) for v in value)
        if self.kind == "town":
            return value["town"] if value["town"] == OUTSIDE_MA else f"{value['town']} ({value['county']} County)"
        if self.kind == "body":
            return f"{value['height_in'] // 12} ft {value['height_in'] % 12} in, {value['weight_lb']} lb (BMI {value['bmi']})"
        return str(labels.get(value, value))


def _patient(answers: dict) -> bool:
    return answers.get("role") in PATIENT_ROLES


def _designer(answers: dict) -> bool:
    return answers.get("role") == "trial_designer"


def _may_be_pregnant(answers: dict) -> bool:
    age = answers.get("age")
    return _patient(answers) and answers.get("sex") != "male" and (age is None or age < 55)


QUESTIONS: tuple[Question, ...] = (
    Question(
        "role", "First, which best describes you?", "single",
        options=(
            ("patient", "I have cancer, or I'm being checked for it"),
            ("caregiver", "I'm helping a family member or friend with cancer"),
            ("trial_designer", "I design, run or study clinical trials"),
        ),
    ),

    # Patient and caregiver path. Caregivers answer for the person they help.
    Question("age", "How old are you?", "number", min_value=0, max_value=120, show_if=_patient),
    Question(
        "sex", "What sex were you assigned at birth?", "single",
        options=(("female", "Female"), ("male", "Male"), ("prefer_not", "Prefer not to say")),
        help="Some trials only enroll one sex, for example prostate or ovarian cancer trials.",
        show_if=_patient,
    ),
    Question(
        "home", "Where do you live?", "town",
        help="Start typing your city or town. We use it to find trial sites near you.",
        show_if=_patient,
    ),
    Question(
        "travel", "How far could you travel for trial visits?", "single",
        options=(
            ("near", "Only close to home (about 30 minutes)"),
            ("hour", "Up to about an hour"),
            ("state", "Anywhere in Massachusetts, including Boston"),
        ),
        show_if=_patient,
    ),
    Question("cancer_type", "What type of cancer is it?", "select",
             options=CANCER_TYPES + (("not_sure", "Not sure yet"),), show_if=_patient),
    Question(
        "cancer_stage", "How far has it spread?", "single",
        options=(
            ("early", "Early stage (stage 0 to 2)"),
            ("locally_advanced", "Locally advanced (stage 3)"),
            ("metastatic", "Spread to other parts of the body (stage 4)"),
            ("not_sure", "Not sure"),
        ),
        show_if=_patient,
    ),
    Question(
        "treatment_status", "Where are you with treatment?", "single",
        options=(
            ("not_started", "Recently diagnosed, not treated yet"),
            ("in_treatment", "Getting treatment now"),
            ("finished", "Finished treatment"),
            ("recurred", "The cancer came back after treatment"),
        ),
        show_if=_patient,
    ),
    Question(
        "conditions", "Do you have any of these health conditions?", "multi",
        options=(
            ("diabetes", "Diabetes"),
            ("renal", "Kidney disease or reduced kidney function"),
            ("hepatic", "Liver disease, including hepatitis B or C"),
            ("cardiac", "Heart failure, a heart attack or an irregular heartbeat"),
            ("hiv", "HIV"),
            ("brain_mets", "Cancer that has spread to the brain"),
            ("prior_malignancy", "A different cancer in the last 5 years"),
            ("none", "None of these"),
        ),
        help="Pick all that apply. These are the conditions trials most often exclude.",
        show_if=_patient,
    ),
    Question(
        "diabetes_control", "Is your diabetes under control?", "single",
        options=(("controlled", "Yes, it's well controlled"),
                 ("uncontrolled", "No, it's hard to control"),
                 ("not_sure", "Not sure")),
        show_if=lambda a: _patient(a) and "diabetes" in (a.get("conditions") or []),
    ),
    Question(
        "body", "What's your height and weight?", "body",
        help="We use this to work out your BMI, since some trials set a limit.",
        optional=True, show_if=_patient,
    ),
    Question(
        "smoking", "Do you smoke, vape or use other nicotine?", "single",
        options=(("never", "Never"), ("former", "I used to, but I quit"), ("current", "Yes, currently")),
        show_if=_patient,
    ),
    Question(
        "activity", "Which best describes your usual day?", "single",
        # Values are the ECOG performance status (0 to 4).
        options=(
            (0, "Fully active, same as before I got sick"),
            (1, "I can't do hard physical activity, but I can do light work"),
            (2, "Up and about more than half the day. I can look after myself but can't work"),
            (3, "In bed or a chair more than half the day"),
            (4, "Mostly in bed, and I need help looking after myself"),
        ),
        show_if=_patient,
    ),
    Question(
        "pregnancy", "Are you pregnant, breastfeeding or planning a pregnancy?", "single",
        options=(("pregnant", "Pregnant"), ("breastfeeding", "Breastfeeding"),
                 ("planning", "Planning a pregnancy"), ("no", "None of these"),
                 ("prefer_not", "Prefer not to say")),
        show_if=_may_be_pregnant,
    ),
    Question(
        "language", "What language do you prefer for medical conversations?", "select",
        options=(("english", "English"), ("spanish", "Spanish"), ("portuguese", "Portuguese"),
                 ("haitian_creole", "Haitian Creole"), ("chinese", "Chinese"),
                 ("vietnamese", "Vietnamese"), ("other", "Other")),
        show_if=_patient,
    ),
    Question(
        "english_reading", "How comfortable are you reading consent forms in English?", "single",
        options=(("comfortable", "Comfortable"), ("with_help", "OK with some help"),
                 ("not_comfortable", "Not comfortable")),
        show_if=lambda a: _patient(a) and a.get("language") not in (None, "english"),
    ),
    Question(
        "notes", "Anything else a trial team should know?", "text",
        help="For example, treatments you've already had or what matters most to you.",
        optional=True, show_if=_patient,
    ),

    # Trial designer path.
    Question(
        "org_type", "What kind of organization do you work for?", "single",
        options=(("biotech", "Biotech or pharma company"), ("academic", "Academic medical center"),
                 ("cro", "Contract research organization (CRO)"), ("community", "Community hospital"),
                 ("advocacy", "Patient advocacy group"), ("other", "Other")),
        show_if=_designer,
    ),
    Question("org_name", "What's your organization called?", "text", optional=True, show_if=_designer),
    Question(
        "job", "What's your role on trials?", "single",
        options=(("protocol_author", "Protocol author or medical writer"),
                 ("investigator", "Principal investigator"), ("clin_ops", "Clinical operations"),
                 ("biostat", "Biostatistician"), ("regulatory", "Regulatory affairs"),
                 ("other", "Other")),
        show_if=_designer,
    ),
    Question("cancer_focus", "Which cancers do your trials focus on?", "multi",
             options=CANCER_TYPES, help="Pick all that apply.", show_if=_designer),
    Question(
        "phases", "Which trial phases do you work on?", "multi",
        options=(("phase1", "Phase 1"), ("phase2", "Phase 2"), ("phase3", "Phase 3"), ("phase4", "Phase 4")),
        show_if=_designer,
    ),
    Question("counties", "Which Massachusetts counties do you recruit in?", "multi",
             options=tuple((c, c) for c in COUNTY_FIPS), show_if=_designer),
    Question(
        "goals", "What do you want from this tool?", "multi",
        options=(("broaden", "Broaden eligibility criteria"), ("diversity", "Enroll a more diverse population"),
                 ("speed", "Enroll faster"), ("fda", "Follow FDA guidance on eligibility")),
        show_if=_designer,
    ),
    Question("designer_notes", "Anything else we should know?", "text", optional=True, show_if=_designer),
)


def visible_questions(answers: dict) -> list[Question]:
    return [q for q in QUESTIONS if q.show_if(answers)]


def towns() -> dict[str, str]:
    """{town: county} for all 351 MA municipalities, from P1's crosswalk."""
    if not TOWNS_CSV.exists():
        return {}
    df = pd.read_csv(TOWNS_CSV, dtype=str)
    return dict(zip(df["town"], df["county"]))
