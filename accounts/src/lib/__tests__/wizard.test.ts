import { fromDraft, searchTowns, toDraft, toggleOption } from "@/app/profile/drafts";
import { type Answers, QUESTIONS, type Question, answerLabel, homeFor, visibleQuestions } from "@/lib/questions";
import { type WizardState, advance, finalAnswers, initialState, validate } from "@/lib/wizard";

const q = (key: string): Question => QUESTIONS.find((x) => x.key === key)!;
const keys = (answers: Answers) => visibleQuestions(answers).map((x) => x.key);

const PATIENT: Answers = {
  role: "patient",
  age: 64,
  sex: "female",
  home: homeFor("Springfield"),
  travel: "hour",
  cancer_type: "breast",
  cancer_stage: "metastatic",
  treatment_status: "in_treatment",
  conditions: ["diabetes", "renal"],
  diabetes_control: "controlled",
  smoking: "former",
  activity: 1,
  language: "spanish",
  english_reading: "with_help",
};

describe("branching", () => {
  it("shows only the role question before a role is picked", () => {
    expect(keys({})).toEqual(["role"]);
  });

  it("asks the diabetes and English follow-ups only when they apply", () => {
    expect(keys(PATIENT)).toEqual(expect.arrayContaining(["diabetes_control", "english_reading"]));
    const noFollowUps = { ...PATIENT, conditions: ["renal"], language: "english" };
    expect(keys(noFollowUps)).not.toContain("diabetes_control");
    expect(keys(noFollowUps)).not.toContain("english_reading");
  });

  it("skips the pregnancy question for men and anyone 55 or older", () => {
    expect(keys(PATIENT)).not.toContain("pregnancy");
    expect(keys({ ...PATIENT, age: 30 })).toContain("pregnancy");
    expect(keys({ ...PATIENT, age: 30, sex: "male" })).not.toContain("pregnancy");
  });

  it("gives trial designers their own questions", () => {
    expect(keys({ role: "trial_designer" })).toEqual([
      "role", "org_type", "org_name", "job", "cancer_focus", "phases", "counties", "goals", "designer_notes",
    ]);
  });
});

describe("initialState", () => {
  it("starts a new user at the first question", () => {
    expect(initialState(null)).toEqual({ answers: {}, step: 0, mode: "questions", editing: false });
  });

  it("resumes at the first unanswered required question", () => {
    const state = initialState({ answers: { role: "caregiver", age: 30, sex: "female" }, completed: false });
    expect(state.mode).toBe("questions");
    expect(visibleQuestions(state.answers)[state.step].key).toBe("home");
  });

  it("opens a finished profile on the summary, and a fully answered draft on the review", () => {
    expect(initialState({ answers: PATIENT, completed: true }).mode).toBe("saved");
    expect(initialState({ answers: PATIENT, completed: false }).mode).toBe("review");
  });
});

describe("advance", () => {
  const at = (answers: Answers, key: string, editing = false): WizardState => ({
    answers,
    step: keys(answers).indexOf(key),
    mode: "questions",
    editing,
  });

  it("moves to the next question", () => {
    const next = advance(at({}, "role"), q("role"), "patient");
    expect(next.answers).toEqual({ role: "patient" });
    expect(keys(next.answers)[next.step]).toBe("age");
  });

  it("opens the diabetes follow-up when diabetes is ticked", () => {
    const answers: Answers = { ...PATIENT, conditions: ["renal"] };
    delete answers.diabetes_control;
    const next = advance(at(answers, "conditions"), q("conditions"), ["diabetes"]);
    expect(keys(next.answers)[next.step]).toBe("diabetes_control");
  });

  it("goes back to the review after an edit that opens nothing new", () => {
    const next = advance(at(PATIENT, "conditions", true), q("conditions"), ["renal"]);
    expect(next).toMatchObject({ mode: "review", editing: false });
  });

  it("stops at a question an edit opened up, then returns to the review", () => {
    const answers: Answers = { ...PATIENT, conditions: ["renal"] };
    delete answers.diabetes_control;
    const opened = advance(at(answers, "conditions", true), q("conditions"), ["diabetes"]);
    expect(keys(opened.answers)[opened.step]).toBe("diabetes_control");
    const done = advance(opened, q("diabetes_control"), "uncontrolled");
    expect(done.mode).toBe("review");
  });

  it("removes the answer when a question is skipped", () => {
    const next = advance(at({ ...PATIENT, notes: "x" }, "notes"), q("notes"), undefined);
    expect(next.answers).not.toHaveProperty("notes");
    expect(next.mode).toBe("review");
  });
});

describe("validate", () => {
  it("requires an answer unless the question is optional", () => {
    expect(validate(q("role"), undefined)).toMatch(/answer this one/);
    expect(validate(q("notes"), undefined)).toBeNull();
  });

  it("rejects 'None of these' combined with a condition", () => {
    expect(validate(q("conditions"), ["none", "hiv"])).toMatch(/None of these/);
    expect(validate(q("conditions"), ["none"])).toBeNull();
  });

  it("checks the age range", () => {
    expect(validate(q("age"), 130)).toMatch(/0 to 120/);
    expect(validate(q("age"), 64)).toBeNull();
  });
});

describe("finalAnswers", () => {
  it("drops answers that no longer apply", () => {
    const stale = { ...PATIENT, conditions: ["renal"], org_type: "cro" };
    expect(finalAnswers(stale)).not.toHaveProperty("diabetes_control");
    expect(finalAnswers(stale)).not.toHaveProperty("org_type");
    expect(finalAnswers(PATIENT)).toEqual(PATIENT);
  });
});

describe("answerLabel", () => {
  it("shows readable labels, not codes", () => {
    expect(answerLabel(q("home"), PATIENT.home)).toBe("Springfield (Hampden County)");
    expect(answerLabel(q("conditions"), ["diabetes", "renal"])).toBe(
      "Diabetes, Kidney disease or reduced kidney function",
    );
    expect(answerLabel(q("activity"), 1)).toMatch(/light work/);
    expect(answerLabel(q("body"), { height_in: 64, weight_lb: 190, bmi: 32.6 })).toBe("5 ft 4 in, 190 lb (BMI 32.6)");
    expect(answerLabel(q("notes"), undefined)).toBe("Skipped");
  });
});

describe("drafts", () => {
  it("maps a town to its county and FIPS code", () => {
    expect(homeFor("Springfield")).toEqual({ town: "Springfield", county: "Hampden", county_fips: "25013" });
    expect(fromDraft(q("home"), { query: "boston", selected: null }).value).toEqual({
      town: "Boston",
      county: "Suffolk",
      county_fips: "25025",
    });
    expect(fromDraft(q("home"), { query: "Gotham", selected: null }).error).toMatch(/from the list/);
    expect(fromDraft(q("home"), { query: "", selected: "Outside Massachusetts" }).value).toEqual({
      town: "Outside Massachusetts",
      county: null,
      county_fips: null,
    });
  });

  it("lists towns that start with the search first", () => {
    const results = searchTowns("spring");
    expect(results[0]).toBe("Springfield");
    expect(results).toContain("West Springfield");
  });

  it("works out BMI and catches half-filled height and weight", () => {
    expect(fromDraft(q("body"), { feet: "5", inches: "4", weight: "190" }).value).toEqual({
      height_in: 64,
      weight_lb: 190,
      bmi: 32.6,
    });
    expect(fromDraft(q("body"), { feet: "5", inches: "", weight: "" }).error).toMatch(/both height and weight/);
    expect(fromDraft(q("body"), { feet: "", inches: "", weight: "" })).toEqual({});
  });

  it("round-trips saved answers back into drafts", () => {
    expect(toDraft(q("body"), { height_in: 64, weight_lb: 190, bmi: 32.6 })).toEqual({
      feet: "5",
      inches: "4",
      weight: "190",
    });
    expect(fromDraft(q("age"), toDraft(q("age"), 64)).value).toBe(64);
  });

  it("keeps 'None of these' on its own", () => {
    expect(toggleOption(["diabetes"], "none")).toEqual(["none"]);
    expect(toggleOption(["none"], "hiv")).toEqual(["hiv"]);
    expect(toggleOption(["hiv", "renal"], "hiv")).toEqual(["renal"]);
  });
});
