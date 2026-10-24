"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { button, card, input } from "@/components/styles";
import type { AnswerValue, Question } from "@/lib/questions";
import { validate } from "@/lib/wizard";

import { type BodyDraft, type Draft, type TownDraft, fromDraft, toDraft, toggleOption } from "./drafts";
import { TownInput } from "./town-input";

type Props = {
  question: Question;
  initial: AnswerValue | undefined;
  note?: string;
  canGoBack: boolean;
  onBack: () => void;
  onNext: (value: AnswerValue | undefined) => void;
};

/** One question on its own card. Mount it with key={question.key} so each question starts fresh. */
export function QuestionStep({ question: q, initial, note, canGoBack, onBack, onNext }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(q, initial));
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const helpId = useId();

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function update(next: Draft) {
    setDraft(next);
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const { value, error: draftError } = fromDraft(q, draft);
    const problem = draftError ?? validate(q, value);
    if (problem) setError(problem);
    else onNext(value);
  }

  const field = { headingId, helpId: q.help ? helpId : undefined };

  return (
    <form onSubmit={submit} noValidate className={card}>
      {note && <p className="mb-2 text-sm font-medium text-brand">{note}</p>}
      <h2
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none sm:text-2xl"
      >
        {q.prompt}
      </h2>
      {q.help && (
        <p id={helpId} className="mt-1 text-sm text-muted">
          {q.help}
        </p>
      )}

      <div className="mt-5">
        {q.kind === "single" && <SingleChoice q={q} value={draft as string | number} onChange={update} {...field} />}
        {q.kind === "multi" && <MultiChoice q={q} value={draft as string[]} onChange={update} {...field} />}
        {q.kind === "number" && (
          <input
            inputMode="numeric"
            aria-labelledby={headingId}
            aria-describedby={field.helpId}
            placeholder="Type a number"
            value={draft as string}
            onChange={(e) => update(e.target.value)}
            className={`${input} max-w-40`}
          />
        )}
        {q.kind === "text" && (
          <textarea
            aria-labelledby={headingId}
            aria-describedby={field.helpId}
            rows={4}
            maxLength={1000}
            value={draft as string}
            onChange={(e) => update(e.target.value)}
            className={input}
          />
        )}
        {q.kind === "town" && (
          <TownInput draft={draft as TownDraft} onChange={update} labelledBy={headingId} describedBy={field.helpId} />
        )}
        {q.kind === "body" && <BodyFields q={q} draft={draft as BodyDraft} onChange={update} />}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button type="button" onClick={onBack} disabled={!canGoBack} className={button.secondary}>
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </button>
        <div className="flex-1" />
        {q.optional && (
          <button type="button" onClick={() => onNext(undefined)} className={button.ghost}>
            Skip
          </button>
        )}
        <button type="submit" className={button.primary}>
          Next
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </form>
  );
}

type FieldProps<T> = {
  q: Question;
  value: T;
  onChange: (value: T) => void;
  headingId: string;
  helpId?: string;
};

const optionCard =
  "flex cursor-pointer items-start gap-3 rounded-md border border-border-strong bg-card px-4 py-3 transition " +
  "hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-soft " +
  "has-[:checked]:ring-1 has-[:checked]:ring-brand " +
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand";

function SingleChoice({ q, value, onChange, headingId, helpId }: FieldProps<string | number>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={headingId}
      aria-describedby={helpId}
      className={`grid gap-2 ${q.columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {q.options?.map((o) => (
        <label key={o.value} className={optionCard}>
          <input
            type="radio"
            name={q.key}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5 size-4 shrink-0 accent-brand"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function MultiChoice({ q, value, onChange, headingId, helpId }: FieldProps<string[]>) {
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      aria-describedby={helpId}
      className={`grid gap-2 ${(q.options?.length ?? 0) > 6 ? "sm:grid-cols-2" : ""}`}
    >
      {q.options?.map((o) => (
        <label key={o.value} className={optionCard}>
          <input
            type="checkbox"
            checked={value.includes(String(o.value))}
            onChange={() => onChange(toggleOption(value, String(o.value)))}
            className="mt-0.5 size-4 shrink-0 accent-brand"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function BodyFields({ q, draft, onChange }: { q: Question; draft: BodyDraft; onChange: (d: BodyDraft) => void }) {
  const preview = fromDraft(q, draft).value as { bmi: number } | undefined;
  const boxes: { key: keyof BodyDraft; label: string }[] = [
    { key: "feet", label: "Height (ft)" },
    { key: "inches", label: "Inches" },
    { key: "weight", label: "Weight (lb)" },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {boxes.map(({ key, label }) => (
          <label key={key} className="text-sm font-medium">
            {label}
            <input
              inputMode="numeric"
              value={draft[key]}
              onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
              className={`${input} mt-1.5`}
            />
          </label>
        ))}
      </div>
      <p className="mt-3 min-h-5 text-sm text-muted">{preview ? `BMI ${preview.bmi}` : ""}</p>
    </div>
  );
}
