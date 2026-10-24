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
| brain_mets | 0.88 | 0.94 | 0.91 | 15 | 2 | 1 | 16 |
| prior_malignancy | 0.93 | 0.72 | 0.81 | 13 | 1 | 5 | 18 |
| performance_status | 1.00 | 1.00 | 1.00 | 26 | 0 | 0 | 26 |
| language | 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 4 |
| pregnancy | 1.00 | 1.00 | 1.00 | 19 | 0 | 0 | 19 |
| **overall (micro)** | **0.97** | **0.91** | **0.94** | 139 | 5 | 13 | 152 |

## By subset (overall micro)

| subset | trials | precision | recall | F1 | TP | FP | FN |
|--------|--------|-----------|--------|----|----|----|----|
| random sample (original 30) | 30 | 0.96 | 0.91 | 0.93 | 86 | 4 | 9 |
| targeted (picked for a category) | 2 | 1.00 | 1.00 | 1.00 | 7 | 0 | 0 |
| held-out (prompt never tuned on these) | 10 | 0.98 | 0.92 | 0.95 | 46 | 1 | 4 |

Quote the held-out row as the headline accuracy: the extraction prompt was tuned while looking at errors on the original 32, so their scores are optimistic.

- **Precision** = of the categories the extractor flagged, how many the human agreed with.
- **Recall** = of the categories the human labeled, how many the extractor caught.
- `-` means no instances (no gold positives and no predictions for that category).
- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).
