"""Pick the 30-trial gold set: seeded random sample, filled into quotas.

Pulls the same pool P1 uses (recruiting MA cancer trials, keeping only trials
with a recruiting MA site, matching build_trials.py), shuffles it with a fixed
seed, and fills phase / sponsor quotas with a cap per cancer type.

Writes:
  eval/gold_ids.txt          one NCT ID per line
  eval/gold_ids_meta.csv     why each trial was picked (for the "how we sampled" slide)
  eval/criteria/NCT*.md      title, link, and criteria text, ready to label
  eval/gold_labels.csv       header only (created if missing; never overwritten)

Usage (from repo root):
    python eval/pick_gold.py                 # pick 30 with seed 2026
    python eval/pick_gold.py --targeted      # also add up to 2 trials per category with 0 coverage
    python eval/pick_gold.py --seed 7        # different random draw
    python eval/pick_gold.py --refresh       # refetch the pool instead of using the cache
    python eval/pick_gold.py --extend 10     # append 10 held-out random trials; keeps the existing set
"""
from __future__ import annotations

import argparse
import collections
import csv
import json
import random
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "eval"
CACHE = EVAL / ".pool_cache.json"

API = "https://clinicaltrials.gov/api/v2/studies"
PARAMS = {
    "query.locn": "Massachusetts",
    "query.cond": "cancer",
    "filter.overallStatus": "RECRUITING",
    "pageSize": 200,
    "fields": ",".join([
        "NCTId", "BriefTitle", "Phase", "StudyType", "Condition",
        "LeadSponsorName", "LeadSponsorClass", "EligibilityCriteria",
        "LocationState", "LocationStatus",
    ]),
}

TOTAL = 30
PHASE_QUOTA = {"phase1": 6, "phase2": 8, "phase3": 6, "phase4_na": 4, "observational": 6}
SPONSOR_QUOTA = {"industry": 12, "academic": 12, "nci_coop": 6}
CANCER_CAP = 5

# Order matters: first match wins. Supportive care is checked first so
# "exercise for breast cancer survivors" lands in supportive, not breast.
CANCER_TYPES = [
    ("supportive", r"survivor|quality of life|fatigue|neuropath|nausea|\bpain\b|symptom|"
                   r"exercise|distress|caregiver|palliative|smoking cessation|anxiety|insomnia"),
    ("breast", r"breast"),
    ("lung", r"lung|nsclc|sclc|mesothelioma|thoracic"),
    ("heme", r"leukemia|lymphoma|myeloma|myelodysplastic|\bmds\b|\baml\b|\bcll\b|\ball\b|"
             r"hematolog|myeloproliferative|transplant"),
    ("gi", r"pancrea|colorectal|colon|rectal|gastric|stomach|esophag|hepatocellular|liver|"
           r"biliary|cholangio|gastrointestinal|anal\b"),
    ("gu", r"prostate|bladder|urothelial|renal cell|kidney|testicular|genitourinary"),
    ("gyn", r"ovarian|cervical|endometrial|uterine|gynecolog"),
    ("brain", r"glioma|glioblastoma|brain|cns tumor|meningioma"),
    ("skin", r"melanoma|skin|merkel|basal cell|squamous cell carcinoma of the skin"),
    ("head_neck", r"head and neck|oropharyn|laryn|thyroid|nasopharyn|oral cavity"),
    ("sarcoma", r"sarcoma"),
    ("solid_multi", r"solid tumor|advanced cancer|metastatic cancer"),
]

NCI_COOP = re.compile(r"national cancer institute|\bnci\b|alliance for clinical|ecog|nrg oncology|"
                      r"swog|children's oncology group|canadian cancer trials", re.I)

# Rough keyword screen for coverage only. These are NOT labels.
CATEGORY_HINTS = {
    "diabetes": r"diabet|hba1c|hemoglobin a1c",
    "bmi": r"\bbmi\b|body mass index|kg/m",
    "smoking": r"smok|tobacco|nicotine|cigarette",
    "renal": r"creatinine|crcl|egfr|renal|kidney function",
    "hepatic": r"bilirubin|\bast\b|\balt\b|hepatic|liver function|transaminase",
    "cardiac": r"nyha|myocardial infarction|lvef|ejection fraction|qtc|heart failure",
    "hiv": r"\bhiv\b|human immunodeficiency",
    "brain_mets": r"brain metast|cns metast|central nervous system metast|leptomening",
    "prior_malignancy": r"(prior|other|another|second|concurrent|previous) (invasive )?malignan|"
                        r"history of (a |another )?(invasive )?(cancer|malignan)",
    "performance_status": r"ecog|karnofsky|performance status|lansky",
    "language": r"english|spanish|language|interpreter",
    "pregnancy": r"pregnan|breast[- ]?feeding|lactat|nursing",
}
# 'age' is left out: build_trials.py takes it from the structured min/max age fields.

# Stricter screen for --targeted picks, so a BMI *floor* (e.g. "BMI > 25" as an
# inclusion) doesn't count as a BMI cap. Still a screen, not a label.
BMI = r"(bmi|body mass index)[^.\n]{0,30}?"
BMI_CAP_ANY = re.compile(BMI + r"(<|≤|less than|under|below|no more than|not exceed|maximum|up to)\s*\d", re.I)
BMI_OVER = re.compile(BMI + r"(>|≥|greater than|over|above|at least)\s*\d", re.I)


def has_bmi_cap(criteria: str) -> bool:
    exclusion = " ".join(re.split(r"exclusion criteria", criteria, flags=re.I)[1:])
    return bool(BMI_CAP_ANY.search(criteria) or BMI_OVER.search(exclusion))


TARGET_FILTERS = {"bmi": lambda t: has_bmi_cap(t["criteria"])}


# ---------- fetching ----------

def fetch_pool(refresh: bool) -> list[dict]:
    if CACHE.exists() and not refresh:
        studies = json.loads(CACHE.read_text())
        print(f"Using cached pool ({len(studies)} studies). --refresh to refetch.")
        return studies
    studies, token = [], None
    while True:
        params = dict(PARAMS, **({"pageToken": token} if token else {}))
        for attempt in range(4):
            try:
                r = requests.get(API, params=params, timeout=60)
                if r.status_code == 400:
                    sys.exit(f"400 from API:\n{r.text[:800]}")
                r.raise_for_status()
                break
            except requests.RequestException as e:
                print(f"  retry {attempt + 1}: {e}")
                time.sleep(2 ** attempt)
        else:
            sys.exit("ClinicalTrials.gov unreachable.")
        data = r.json()
        studies.extend(data.get("studies", []))
        print(f"  fetched {len(studies)} studies")
        token = data.get("nextPageToken")
        if not token:
            break
        time.sleep(0.3)
    CACHE.write_text(json.dumps(studies))
    return studies


# ---------- classification ----------

def summarize(study: dict) -> dict | None:
    """Flatten one study; None if it has no recruiting MA site (P1 drops those too)."""
    ps = study.get("protocolSection", {})
    locs = ps.get("contactsLocationsModule", {}).get("locations", []) or []
    ma_ok = any(str(l.get("state", "")).lower() in ("massachusetts", "ma")
                and l.get("status") in (None, "", "RECRUITING") for l in locs)
    if not ma_ok:
        return None

    title = ps.get("identificationModule", {}).get("briefTitle", "")
    conditions = ps.get("conditionsModule", {}).get("conditions", []) or []
    phases = ps.get("designModule", {}).get("phases", []) or []
    study_type = ps.get("designModule", {}).get("studyType", "")
    sponsor = ps.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}) or {}
    criteria = ps.get("eligibilityModule", {}).get("eligibilityCriteria", "") or ""

    if study_type == "OBSERVATIONAL":
        phase = "observational"
    elif "PHASE3" in phases:
        phase = "phase3"
    elif "PHASE2" in phases:
        phase = "phase2"           # includes Phase 1/2
    elif "PHASE1" in phases or "EARLY_PHASE1" in phases:
        phase = "phase1"
    else:
        phase = "phase4_na"

    cls, name = sponsor.get("class", ""), sponsor.get("name", "")
    if cls == "INDUSTRY":
        sponsor_type = "industry"
    elif cls in ("NIH", "FED", "NETWORK") or NCI_COOP.search(name):
        sponsor_type = "nci_coop"
    else:
        sponsor_type = "academic"

    text = (title + " " + " ".join(conditions)).lower()
    cancer = next((k for k, pat in CANCER_TYPES if re.search(pat, text)), "other")

    return {
        "nct_id": ps.get("identificationModule", {}).get("nctId"),
        "title": title, "conditions": "; ".join(conditions),
        "phase_raw": "/".join(phases) or study_type,
        "phase": phase, "sponsor_type": sponsor_type, "cancer_type": cancer,
        "lead_sponsor": name, "criteria": criteria,
        "hints": {c for c, pat in CATEGORY_HINTS.items() if re.search(pat, criteria, re.I)},
    }


# ---------- sampling ----------

def pick(pool: list[dict], rng: random.Random) -> list[dict]:
    order = pool[:]
    rng.shuffle(order)
    chosen, ids = [], set()
    phase_n, sponsor_n, cancer_n = (collections.Counter() for _ in range(3))

    def take(t, method):
        chosen.append({**t, "pick_method": method})
        ids.add(t["nct_id"])
        phase_n[t["phase"]] += 1
        sponsor_n[t["sponsor_type"]] += 1
        cancer_n[t["cancer_type"]] += 1

    # Pass 1: respect every quota. Pass 2: drop the sponsor quota.
    # Pass 3: drop everything but the cancer cap. Pass 4: fill to 30.
    passes = [
        lambda t: phase_n[t["phase"]] < PHASE_QUOTA[t["phase"]]
                  and sponsor_n[t["sponsor_type"]] < SPONSOR_QUOTA[t["sponsor_type"]]
                  and cancer_n[t["cancer_type"]] < CANCER_CAP,
        lambda t: phase_n[t["phase"]] < PHASE_QUOTA[t["phase"]]
                  and cancer_n[t["cancer_type"]] < CANCER_CAP,
        lambda t: cancer_n[t["cancer_type"]] < CANCER_CAP,
        lambda t: True,
    ]
    for i, ok in enumerate(passes, 1):
        for t in order:
            if len(chosen) >= TOTAL:
                break
            if t["nct_id"] not in ids and ok(t):
                take(t, "random" if i == 1 else f"random_relaxed{i}")
    return chosen


def add_targeted(chosen: list[dict], pool: list[dict], rng: random.Random) -> list[dict]:
    ids = {t["nct_id"] for t in chosen}
    covered = collections.Counter(c for t in chosen for c in t["hints"])
    extra = []
    for cat in CATEGORY_HINTS:
        if covered[cat] > 0:
            continue
        extra_ok = TARGET_FILTERS.get(cat, lambda t: True)
        candidates = [t for t in pool if cat in t["hints"] and t["nct_id"] not in ids
                      and extra_ok(t)]
        rng.shuffle(candidates)
        for t in candidates[:2]:
            extra.append({**t, "pick_method": f"targeted:{cat}"})
            ids.add(t["nct_id"])
    return chosen + extra


def pick_extension(pool: list[dict], existing: set[str], n: int,
                   rng: random.Random) -> list[dict]:
    """n random trials not already in the gold set, max 3 per cancer type."""
    order = [t for t in pool if t["nct_id"] not in existing]
    rng.shuffle(order)
    chosen, cancer_n = [], collections.Counter()
    for t in order:
        if len(chosen) >= n:
            break
        if cancer_n[t["cancer_type"]] < 3:
            chosen.append({**t, "pick_method": "holdout"})
            cancer_n[t["cancer_type"]] += 1
    return chosen


def append_outputs(new: list[dict], start: int, seed: int):
    """Add trials to the gold files without touching existing picks or labels."""
    with open(EVAL / "gold_ids.txt", "a") as f:
        f.write("".join(t["nct_id"] + "\n" for t in new))
    with open(EVAL / "gold_ids_meta.csv", "a", newline="") as f:
        w = csv.writer(f)
        for t in new:
            w.writerow([t["nct_id"], t["phase"], t["cancer_type"], t["sponsor_type"],
                        t["pick_method"], t["lead_sponsor"], t["title"], seed])
    for i, t in enumerate(new, start):
        (EVAL / "criteria" / f"{t['nct_id']}.md").write_text(
            f"# {i:02d}. {t['nct_id']}: {t['title']}\n\n"
            f"https://clinicaltrials.gov/study/{t['nct_id']}\n\n"
            f"- Phase: {t['phase_raw']}\n- Conditions: {t['conditions']}\n"
            f"- Sponsor: {t['lead_sponsor']}\n\n---\n\n{t['criteria']}\n")


# ---------- output ----------

def write_outputs(chosen: list[dict], seed: int):
    (EVAL / "gold_ids.txt").write_text("\n".join(t["nct_id"] for t in chosen) + "\n")

    with open(EVAL / "gold_ids_meta.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["nct_id", "phase", "cancer_type", "sponsor_type", "pick_method",
                    "lead_sponsor", "title", "seed"])
        for t in chosen:
            w.writerow([t["nct_id"], t["phase"], t["cancer_type"], t["sponsor_type"],
                        t["pick_method"], t["lead_sponsor"], t["title"], seed])

    crit_dir = EVAL / "criteria"
    crit_dir.mkdir(exist_ok=True)
    for old in crit_dir.glob("NCT*.md"):  # clear files from a previous draw
        old.unlink()
    for i, t in enumerate(chosen, 1):
        (crit_dir / f"{t['nct_id']}.md").write_text(
            f"# {i:02d}. {t['nct_id']}: {t['title']}\n\n"
            f"https://clinicaltrials.gov/study/{t['nct_id']}\n\n"
            f"- Phase: {t['phase_raw']}\n- Conditions: {t['conditions']}\n"
            f"- Sponsor: {t['lead_sponsor']}\n\n---\n\n{t['criteria']}\n")

    labels = EVAL / "gold_labels.csv"
    if not labels.exists():
        labels.write_text("nct_id,category,threshold,source_text\n")


def report(chosen: list[dict], pool_size: int):
    n_random = sum(t["pick_method"] == "random" for t in chosen)
    print(f"\nPool: {pool_size} trials with a recruiting MA site")
    print(f"Picked: {len(chosen)} ({n_random} strict random, "
          f"{len(chosen) - n_random} relaxed or targeted)\n")

    def show(label, key, quota=None):
        c = collections.Counter(t[key] for t in chosen)
        parts = [f"{k} {v}" + (f"/{quota[k]}" if quota and k in quota else "")
                 for k, v in sorted(c.items(), key=lambda x: -x[1])]
        print(f"{label:<9}" + ", ".join(parts))

    show("Phase", "phase", PHASE_QUOTA)
    show("Sponsor", "sponsor_type", SPONSOR_QUOTA)
    show("Cancer", "cancer_type")

    covered = collections.Counter(c for t in chosen for c in t["hints"])
    print("\nCategory coverage (keyword screen, not labels; aim for 2+ each):")
    for cat in CATEGORY_HINTS:
        n = covered[cat]
        flag = "   <- zero: rerun with --targeted" if n == 0 else ("   <- low" if n == 1 else "")
        print(f"  {cat:<20}{n:>3}{flag}")
    print("\nWrote eval/gold_ids.txt, eval/gold_ids_meta.csv, eval/criteria/*.md")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--targeted", action="store_true",
                    help="add up to 2 trials for each category with zero coverage")
    ap.add_argument("--refresh", action="store_true", help="refetch the trial pool")
    ap.add_argument("--extend", type=int, metavar="N",
                    help="append N held-out random trials to the existing gold set")
    args = ap.parse_args()

    pool = [t for t in (summarize(s) for s in fetch_pool(args.refresh))
            if t and t["nct_id"] and t["criteria"].strip()]
    if len(pool) < TOTAL:
        sys.exit(f"Only {len(pool)} usable trials in the pool.")

    if args.extend:
        # Only trials P1/P2 already have, so every pick has an extraction to score.
        with open(ROOT / "data" / "processed" / "trials.csv", newline="") as f:
            known = {r["nct_id"] for r in csv.DictReader(f)}
        existing = set((EVAL / "gold_ids.txt").read_text().split())
        new = pick_extension([t for t in pool if t["nct_id"] in known], existing,
                             args.extend, random.Random(f"{args.seed}-extend"))
        append_outputs(new, len(existing) + 1, args.seed)
        print(f"Added {len(new)} held-out trials (now {len(existing) + len(new)}):")
        for t in new:
            print(f"  {t['nct_id']}  {t['phase']:<14}{t['sponsor_type']:<10}{t['cancer_type']}")
        return

    rng = random.Random(args.seed)
    chosen = pick(pool, rng)
    if args.targeted:
        chosen = add_targeted(chosen, pool, rng)
    write_outputs(chosen, args.seed)
    report(chosen, len(pool))


if __name__ == "__main__":
    main()
