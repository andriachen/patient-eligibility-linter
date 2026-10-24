"""P2: System prompt + tool schema for build-time trial tagging.

Turns a trial's messy condition labels (2,392 distinct, 1,860 one-offs) into a
FIXED cancer-type category + a normalized age range, so the patient matcher can be
a deterministic lookup (no keywords, no inference at query time).

The cancer_type vocabulary MUST stay in sync with the accounts wizard's CANCER_TYPES
(accounts/src/lib/questions.ts) so the patient dropdown and trial tags share one list.
"""

# Patient-facing categories (match the wizard's CANCER_TYPES values) + baskets.
CANCER_TYPES = [
    "breast",
    "lung",
    "colorectal",
    "prostate",
    "blood",          # leukemia / lymphoma / myeloma
    "skin",           # melanoma & other skin
    "pancreatic",
    "gynecologic",    # ovarian / uterine / cervical
    "brain",          # brain or spinal cord PRIMARY tumor
    "kidney_bladder",
    "head_neck",
    "liver_stomach",  # liver / stomach / esophagus
    "other",          # a specific cancer not in the list (e.g. sarcoma, thyroid)
    # baskets — a trial open to many cancer types
    "solid_tumor_basket",   # any/advanced solid tumor
    "blood_cancer_basket",  # any hematologic malignancy
    "any_cancer",           # "Neoplasms"/"Cancer" with no type specified
]

SYSTEM_PROMPT = """You categorize a clinical trial by the cancer it studies, using \
ONLY the trial's condition labels and title.

Return, via the tool:
1) cancer_types: the list of categories this trial is FOR, from this fixed set:
   breast, lung, colorectal, prostate, blood (leukemia/lymphoma/myeloma),
   skin (melanoma/skin), pancreatic, gynecologic (ovarian/uterine/cervical),
   brain (PRIMARY brain or spinal cord tumor), kidney_bladder, head_neck,
   liver_stomach (liver/stomach/esophagus), other (a specific cancer not listed,
   e.g. sarcoma, thyroid), solid_tumor_basket (open to any/advanced solid tumor),
   blood_cancer_basket (open to any blood cancer), any_cancer ("Neoplasms"/"Cancer"
   with no specific type).

Rules:
- Most trials have ONE type; list more only if the trial genuinely spans several
  named cancers. Prefer a single basket over listing many types.
- BRAIN vs BRAIN METASTASIS: "brain" is ONLY for a primary brain/CNS tumor (glioma,
  glioblastoma, astrocytoma, meningioma). A label like "Metastatic Neoplasm to Brain"
  is a solid tumor that spread to the brain, NOT brain cancer — tag its primary type
  if known, else solid_tumor_basket. Do not output "brain" for metastasis-to-brain.
- Baskets: "Solid Tumor", "Advanced Solid Tumors" -> solid_tumor_basket.
  "Hematologic Malignancies" -> blood_cancer_basket. "Neoplasms"/"Cancer" alone ->
  any_cancer.
- If a specific cancer doesn't map to a named category, use "other" (not a basket).

Base everything on the provided condition labels and title."""

TAG_TOOL = {
    "name": "tag_trial",
    "description": "Assign a trial its cancer-type categories from the fixed list.",
    "input_schema": {
        "type": "object",
        "properties": {
            "cancer_types": {
                "type": "array",
                "items": {"type": "string", "enum": CANCER_TYPES},
                "description": "Categories the trial is for (usually one).",
            },
        },
        "required": ["cancer_types"],
    },
}
