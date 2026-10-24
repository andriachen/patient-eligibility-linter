"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";

import { button, card } from "@/components/styles";
import { type Answers, PATIENT_ROLES, type Role, answerLabel, visibleQuestions } from "@/lib/questions";
import { webHref } from "@/lib/web";
import { type SavedProfile, advance, finalAnswers, initialState } from "@/lib/wizard";

import { saveProfile } from "./actions";
import { QuestionStep } from "./question-step";

/** The profile questions, one per screen, saved after every step. `preview` skips saving. */
export function ProfileWizard({ initial, preview = false }: { initial: SavedProfile | null; preview?: boolean }) {
  const [state, setState] = useState(() => initialState(initial));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savesInFlight, setSavesInFlight] = useState(0);
  // Saves run one after another, so an older snapshot can never land after a newer one.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  function persist(answers: Answers, completed: boolean): Promise<boolean> {
    if (preview) return Promise.resolve(true);
    setSavesInFlight((n) => n + 1);
    const run = queue.current.then(async () => {
      try {
        const { error } = await saveProfile(answers, completed);
        setSaveError(error ?? null);
        return !error;
      } catch {
        setSaveError("Couldn't reach the server. Your answers are kept on this page.");
        return false;
      } finally {
        setSavesInFlight((n) => n - 1);
      }
    });
    queue.current = run;
    return run;
  }

  const { answers, mode } = state;

  // The review is long, so after Save or Edit answers the new screen would start scrolled out of view.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [mode]);

  const questions = visibleQuestions(answers);
  const step = Math.min(state.step, questions.length - 1);
  const q = questions[step];
  // The total isn't known until the role question picks a branch.
  const total = "role" in answers ? ` of ${questions.length}` : "";
  const saving = savesInFlight > 0;

  return (
    <div className="space-y-4">
      {saveError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&apos;t save to your account: {saveError}
        </p>
      )}

      {mode === "questions" && (
        <>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              Question {step + 1}
              {total}
            </span>
            <SaveStatus saving={saving} preview={preview} />
          </div>
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={step}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${(step / questions.length) * 100}%` }}
            />
          </div>
          <QuestionStep
            key={q.key}
            question={q}
            initial={answers[q.key]}
            note={answers.role === "caregiver" && q.key !== "role" ? "Answer for the person you're helping." : undefined}
            canGoBack={step > 0}
            onBack={() => setState((s) => ({ ...s, step: step - 1 }))}
            onNext={(value) => {
              const next = advance(state, q, value);
              setState(next);
              void persist(next.answers, false);
            }}
          />
        </>
      )}

      {mode === "review" && (
        <Review
          answers={answers}
          saving={saving}
          onEdit={(step) => setState((s) => ({ ...s, step, mode: "questions", editing: true }))}
          onSave={async () => {
            const final = finalAnswers(answers);
            if (await persist(final, true)) setState({ answers: final, step: 0, mode: "saved", editing: false });
          }}
        />
      )}

      {mode === "saved" && (
        <div className={card}>
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 aria-hidden className="size-5" />
            {preview ? "Done. In preview mode nothing is saved." : "Your profile is saved."}
          </p>
          <Summary answers={answers} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setState((s) => ({ ...s, mode: "review" }))} className={button.secondary}>
              <Pencil aria-hidden className="size-4" />
              Edit answers
            </button>
            {PATIENT_ROLES.includes(answers.role as Role) ? (
              <a href={webHref("/matches")} className={button.secondary}>
                Find trials that may fit
              </a>
            ) : (
              <a href={webHref("/linter")} className={button.secondary}>
                Try the criteria linter
              </a>
            )}
            <a href={webHref("/landscape")} className={button.ghost}>
              Explore MA cancer trials
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveStatus({ saving, preview }: { saving: boolean; preview: boolean }) {
  if (preview) return <span>Preview: not saved</span>;
  if (!saving) return <span>Saved</span>;
  return (
    <span className="flex items-center gap-1">
      <Loader2 aria-hidden className="size-3.5 animate-spin" />
      Saving
    </span>
  );
}

function Review({
  answers,
  saving,
  onEdit,
  onSave,
}: {
  answers: Answers;
  saving: boolean;
  onEdit: (step: number) => void;
  onSave: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const needsConsent = PATIENT_ROLES.includes(answers.role as Role);
  return (
    <div className={card}>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Check your answers</h2>
      <Summary answers={answers} onEdit={onEdit} />
      {needsConsent && (
        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-brand"
          />
          I understand my answers are saved to my account and may be used to match me with trials. This
          isn&apos;t medical advice.
        </label>
      )}
      <button onClick={onSave} disabled={saving || (needsConsent && !agreed)} className={`${button.primary} mt-6`}>
        {saving && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Save profile
      </button>
    </div>
  );
}

function Summary({ answers, onEdit }: { answers: Answers; onEdit?: (step: number) => void }) {
  return (
    <dl className="mt-4 divide-y divide-border">
      {visibleQuestions(answers).map((q, i) => (
        <div key={q.key} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <dt className="text-sm text-muted">{q.prompt}</dt>
            <dd className="mt-0.5 font-medium break-words">{answerLabel(q, answers[q.key])}</dd>
          </div>
          {onEdit && (
            <button onClick={() => onEdit(i)} aria-label={`Edit: ${q.prompt}`} className={`${button.ghost} shrink-0 px-2`}>
              <Pencil aria-hidden className="size-4" />
              Edit
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}
