// Wizard state changes, kept free of React so they're easy to test.

import { type AnswerValue, type Answers, type Question, visibleQuestions } from "./questions";

export type Mode = "questions" | "review" | "saved";

export type WizardState = {
  answers: Answers;
  step: number; // index into visibleQuestions(answers)
  mode: Mode;
  editing: boolean; // came from the review screen, so go back there when done
};

export type SavedProfile = { answers: Answers; completed: boolean };

/** Where to start: a finished profile opens on the summary, an unfinished one on its first gap. */
export function initialState(profile: SavedProfile | null): WizardState {
  const answers = profile?.answers ?? {};
  const unanswered = firstUnanswered(answers, 0);
  if (profile?.completed) return { answers, step: 0, mode: "saved", editing: false };
  if (unanswered === null) return { answers, step: 0, mode: "review", editing: false };
  return { answers, step: unanswered, mode: "questions", editing: false };
}

function firstUnanswered(answers: Answers, from: number): number | null {
  const questions = visibleQuestions(answers);
  const index = questions.findIndex((q, i) => i >= from && !q.optional && !(q.key in answers));
  return index === -1 ? null : index;
}

export function isEmpty(value: AnswerValue | undefined): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** An error to show under the question, or null if the answer can be saved. */
export function validate(q: Question, value: AnswerValue | undefined): string | null {
  if (isEmpty(value)) return q.optional ? null : "Please answer this one to continue.";
  if (q.kind === "multi" && Array.isArray(value) && value.includes("none") && value.length > 1) {
    return "“None of these” can't be picked along with other answers.";
  }
  if (q.kind === "number" && typeof value === "number") {
    if (!Number.isInteger(value) || (q.min !== undefined && value < q.min) || (q.max !== undefined && value > q.max)) {
      return `Enter a whole number from ${q.min} to ${q.max}.`;
    }
  }
  return null;
}

/** Record an answer (undefined clears it, for Skip) and move to the next question or the review. */
export function advance(state: WizardState, q: Question, value: AnswerValue | undefined): WizardState {
  const answers = { ...state.answers };
  if (isEmpty(value)) delete answers[q.key];
  else answers[q.key] = value as AnswerValue;

  const questions = visibleQuestions(answers);
  const from = questions.findIndex((x) => x.key === q.key) + 1;
  const next = state.editing
    ? // Only stop at questions this change opened up, then go back to review.
      firstUnanswered(answers, from)
    : from < questions.length
      ? from
      : null;
  if (next === null) return { answers, step: state.step, mode: "review", editing: false };
  return { ...state, answers, step: next };
}

/** Drop answers left over from questions that no longer apply, like the other role's branch. */
export function finalAnswers(answers: Answers): Answers {
  return Object.fromEntries(
    visibleQuestions(answers)
      .filter((q) => q.key in answers)
      .map((q) => [q.key, answers[q.key]]),
  );
}
