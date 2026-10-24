# Evaluation Results (P4, Phase 2)

Extractor (`data/processed/exclusions.csv`) vs. human gold labels (`eval/gold_labels.csv`), scored at the (trial, category) level over **42 labeled trials**.

| category | precision | recall | F1 | TP | FP | FN | gold support |
|----------|-----------|--------|----|----|----|----|--------------|
| diabetes | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| bmi | 1.00 | 1.00 | 1.00 | 2 | 0 | 0 | 2 |
| smoking | 0.33 | 0.50 | 0.40 | 1 | 2 | 1 | 2 |
| age | 0.57 | 1.00 | 0.73 | 4 | 3 | 0 | 4 |
| renal | 1.00 | 0.87 | 0.93 | 13 | 0 | 2 | 15 |
| hepatic | 1.00 | 0.80 | 0.89 | 12 | 0 | 3 | 15 |
| cardiac | 0.89 | 0.94 | 0.92 | 17 | 2 | 1 | 18 |
| hiv | 0.83 | 0.91 | 0.87 | 10 | 2 | 1 | 11 |
| brain_mets | 0.94 | 0.94 | 0.94 | 15 | 1 | 1 | 16 |
| prior_malignancy | 0.89 | 0.89 | 0.89 | 16 | 2 | 2 | 18 |
| performance_status | 1.00 | 0.96 | 0.98 | 25 | 0 | 1 | 26 |
| language | 1.00 | 1.00 | 1.00 | 4 | 0 | 0 | 4 |
| pregnancy | 0.95 | 0.95 | 0.95 | 18 | 1 | 1 | 19 |
| **overall (micro)** | **0.91** | **0.91** | **0.91** | 139 | 13 | 13 | 152 |

## By subset (overall micro)

| subset | trials | precision | recall | F1 | TP | FP | FN |
|--------|--------|-----------|--------|----|----|----|----|
| random sample (original 30) | 30 | 0.89 | 0.88 | 0.89 | 84 | 10 | 11 |
| targeted (picked for a category) | 2 | 1.00 | 0.86 | 0.92 | 6 | 0 | 1 |
| held-out (prompt never tuned on these) | 10 | 0.94 | 0.98 | 0.96 | 49 | 3 | 1 |

Quote the held-out row as the headline accuracy: the extraction prompt was tuned while looking at errors on the original 32, so their scores are optimistic.

- **Precision** = of the categories the extractor flagged, how many the human agreed with.
- **Recall** = of the categories the human labeled, how many the extractor caught.
- `-` means no instances (no gold positives and no predictions for that category).
- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).
