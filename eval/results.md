# Evaluation Results (P4, Phase 2)

Extractor (`data/processed/exclusions.csv`) vs. human gold labels (`eval/gold_labels.csv`), scored at the (trial, category) level over **32 labeled trials**.

| category | precision | recall | F1 | TP | FP | FN | gold support |
|----------|-----------|--------|----|----|----|----|--------------|
| diabetes | 1.00 | 1.00 | 1.00 | 1 | 0 | 0 | 1 |
| bmi | 0.67 | 1.00 | 0.80 | 2 | 1 | 0 | 2 |
| smoking | 0.67 | 1.00 | 0.80 | 2 | 1 | 0 | 2 |
| age | 0.22 | 0.50 | 0.31 | 2 | 7 | 2 | 4 |
| renal | 1.00 | 0.70 | 0.82 | 7 | 0 | 3 | 10 |
| hepatic | 1.00 | 0.67 | 0.80 | 6 | 0 | 3 | 9 |
| cardiac | 1.00 | 0.85 | 0.92 | 11 | 0 | 2 | 13 |
| hiv | 0.86 | 0.86 | 0.86 | 6 | 1 | 1 | 7 |
| brain_mets | 0.89 | 1.00 | 0.94 | 8 | 1 | 0 | 8 |
| prior_malignancy | 0.92 | 1.00 | 0.96 | 11 | 1 | 0 | 11 |
| performance_status | 1.00 | 0.94 | 0.97 | 17 | 0 | 1 | 18 |
| language | 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 4 |
| pregnancy | 0.80 | 0.92 | 0.86 | 12 | 3 | 1 | 13 |
| **overall (micro)** | **0.86** | **0.87** | **0.86** | 89 | 15 | 13 | 102 |

- **Precision** = of the categories the extractor flagged, how many the human agreed with.
- **Recall** = of the categories the human labeled, how many the extractor caught.
- `-` means no instances (no gold positives and no predictions for that category).
- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).

## Takeaways

- **Overall F1 0.86** (precision 0.86, recall 0.87) on 32 human-labeled trials,
  using `claude-haiku-5-5` with forced tool-use. Gold labels were written by a human
  independently of the extractor, so the comparison is not circular.
- **Strongest categories** are the ones that carry the pitch: `performance_status`
  (F1 0.97), `prior_malignancy` (0.96), `brain_mets` (0.94), `cardiac` (0.92),
  and `language` (1.00) — the equity headline.
- **Recall gaps** in `renal`/`hepatic` (0.70/0.67) come from vague "adequate organ
  function" phrasings the labeler counted but the extractor skipped — a known
  judgment-call boundary, not a systematic miss.

### The one real weakness: `age` (precision 0.22)
- **7 false positives**: the extractor flags a plain `Age ≥ 18` as a restriction.
  The gold guide explicitly says a standard 18 floor is NOT a restriction.
- **2 misses**: genuine age caps it didn't catch (`< 31 at diagnosis`, `40-80`).
- **Fix (not yet applied):** tighten the `age` rule in `prompts.py` so a bare
  minimum of 18 is never emitted, and emphasize maximum caps / minimums above 18.
  This is a prompt change + a cache clear + re-run; it would lift overall precision
  without touching any other category.

### How to reproduce
```bash
python eval/run_eval.py   # reads exclusions.csv + gold_labels.csv, rewrites this file
```
