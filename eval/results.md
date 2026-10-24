# Evaluation Results (P4, Phase 2)

Extractor (`data/processed/exclusions.csv`) vs. human gold labels (`eval/gold_labels.csv`), scored at the (trial, category) level over **42 labeled trials**.

| category | precision | recall | F1 | TP | FP | FN | gold support |
|----------|-----------|--------|----|----|----|----|--------------|
| diabetes | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| bmi | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| smoking | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| age | 0.80 | 1.00 | 0.89 | 4 | 1 | 0 | 4 |
| renal | 1.00 | 0.87 | 0.93 | 13 | 0 | 2 | 15 |
| hepatic | 1.00 | 0.80 | 0.89 | 12 | 0 | 3 | 15 |
| cardiac | 0.95 | 1.00 | 0.97 | 18 | 1 | 0 | 18 |
| hiv | 1.00 | 0.82 | 0.90 | 9 | 0 | 2 | 11 |
| brain_mets | 0.94 | 0.94 | 0.94 | 15 | 1 | 1 | 16 |
| prior_malignancy | 0.93 | 0.72 | 0.81 | 13 | 1 | 5 | 18 |
| performance_status | 1.00 | 1.00 | 1.00 | 26 | 0 | 0 | 26 |
| language | 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 4 |
| pregnancy | 1.00 | 1.00 | 1.00 | 19 | 0 | 0 | 19 |
| **overall (micro)** | **0.97** | **0.91** | **0.94** | 139 | 4 | 13 | 152 |

Overall micro F1 **0.94**, bootstrap 95% CI [0.91, 0.97] (2000 resamples over 42 trials).

## By subset (overall micro)

| subset | trials | precision | recall | F1 | F1 95% CI | TP | FP | FN |
|--------|--------|-----------|--------|----|-----------|----|----|----|
| random sample (original 30) | 30 | 0.97 | 0.91 | 0.93 | [0.90, 0.97] | 86 | 3 | 9 |
| targeted (picked for a category) | 2 | 1.00 | 1.00 | 1.00 | [1.00, 1.00] | 7 | 0 | 0 |
| held-out (prompt never tuned on these) | 10 | 0.98 | 0.92 | 0.95 | [0.89, 0.99] | 46 | 1 | 4 |

Quote the held-out row as the headline accuracy: the extraction prompt was tuned while looking at errors on the original set, so those scores are optimistic. The held-out interval is wide because it is only 10 trials.

- **Precision** = of the categories the extractor flagged, how many the human agreed with.
- **Recall** = of the categories the human labeled, how many the extractor caught.
- `-` means no instances (no gold positives and no predictions for that category).
- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).

## Known weak spots (not yet fixed)

`prior_malignancy` has the lowest recall and accounts for most of the misses (the model simply never emits the category on those trials). Fixing it needs a **prompt change**, deliberately not done here: tuning against the held-out errors would spend the held-out set. If pursued, label a fresh 10 held-out trials first and quote the new held-out number, not the current one.

**7 long trials return zero records**, and for 5 the model fails identically every time (retry does not help), despite a clear restriction in the text — e.g. NCT07166406 'ECOG 0-2', NCT07297979 'Karnofsky >= 70%', NCT04628767 'must not be pregnant or breast-feeding'. These are undercounted in the app. A real fix needs a larger model or splitting inclusion/exclusion into separate calls.

## Reproduce

```bash
python eval/run_eval.py   # regenerates this file from exclusions.csv + gold_labels.csv
```
The bootstrap CI uses a fixed seed (0), so these numbers are stable across runs.
