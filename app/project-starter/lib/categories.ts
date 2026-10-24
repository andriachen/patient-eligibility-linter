export const CATEGORY_LABELS: Record<string, string> = {
  diabetes: "Diabetes",
  bmi: "BMI",
  smoking: "Smoking",
  age: "Age",
  renal: "Renal",
  hepatic: "Hepatic",
  cardiac: "Cardiac",
  hiv: "HIV",
  brain_mets: "Brain metastases",
  prior_malignancy: "Prior malignancy",
  performance_status: "Performance status",
  language: "Language",
  pregnancy: "Pregnancy",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
}
