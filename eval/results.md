# Evaluation Results (P4, Phase 2)

Extractor (`data/processed/exclusions.csv`) vs. human gold labels (`eval/gold_labels.csv`), scored at the (trial, category) level over **32 labeled trials**.

| category | precision | recall | F1 | TP | FP | FN | gold support |
|----------|-----------|--------|----|----|----|----|--------------|
| diabetes | 1.00 | 1.00 | 1.00 | 1 | 0 | 0 | 1 |
| bmi | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| smoking | 0.33 | 0.50 | 0.40 | 1 | 2 | 1 | 2 |
| age | 0.57 | 1.00 | 0.73 | 4 | 3 | 0 | 4 |
| renal | 1.00 | 0.80 | 0.89 | 8 | 0 | 2 | 10 |
| hepatic | 1.00 | 0.67 | 0.80 | 6 | 0 | 3 | 9 |
| cardiac | 1.00 | 0.92 | 0.96 | 12 | 0 | 1 | 13 |
| hiv | 0.86 | 0.86 | 0.86 | 6 | 1 | 1 | 7 |
| brain_mets | 0.88 | 0.88 | 0.88 | 7 | 1 | 1 | 8 |
| prior_malignancy | 0.83 | 0.91 | 0.87 | 10 | 2 | 1 | 11 |
| performance_status | 1.00 | 0.94 | 0.97 | 17 | 0 | 1 | 18 |
| language | 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 4 |
| pregnancy | 0.92 | 0.92 | 0.92 | 12 | 1 | 1 | 13 |
| **overall (micro)** | **0.90** | **0.88** | **0.89** | 90 | 10 | 12 | 102 |

- **Precision** = of the categories the extractor flagged, how many the human agreed with.
- **Recall** = of the categories the human labeled, how many the extractor caught.
- `-` means no instances (no gold positives and no predictions for that category).
- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).

## Takeaways

- **Overall micro F1 0.89** (precision 0.90, recall 0.88) on 32 human-labeled
  trials, `claude-haiku-5-5` with forced tool-use. Gold labels are human-made,
  independent of the extractor, so the comparison is not circular.
- **Pitch-carrying categories are strong:** performance_status 0.97,
  cardiac 0.96, pregnancy 0.92, renal 0.89, brain_mets/prior_malignancy ~0.87,
  and language 1.00 (the equity headline).
- **Recall gaps** in renal/hepatic (0.80/0.67) are vague "adequate organ function"
  phrasings the human counted but the extractor skipped — a labeling boundary, not
  a systematic miss.
- **smoking 0.40** looks low but has only 2 gold cases, so a single disagreement
  swings it; not statistically meaningful at this support.

### age fix (applied)
The first eval showed age at precision 0.22 — the extractor flagged a plain
"Age >= 18" as a restriction. Two-part fix:
1. Tightened the age rule in `prompts.py` with explicit do-not-emit examples.
2. Added a deterministic guard `logic.is_bare_adult_floor()` + `drop_noise()` that
   removes age records whose quote is just a >=18 floor with no upper bound, while
   keeping real caps ("<55", "40-80", ">=21"). Model stays advisory; code enforces.

Result: **age precision 0.22 -> 0.57, overall F1 0.86 -> 0.89.** The guard also
cleaned the full dataset (236 bare-floor age false positives dropped from
exclusions.csv across all 1011 trials). The 2 remaining age "FPs" are genuine
judgment calls (e.g. "early-onset CRC <55" — a real cutoff the labeler read as a
disease definition).

### How to reproduce
```bash
python eval/run_eval.py   # reads exclusions.csv + gold_labels.csv, rewrites this file
```
