"use client";

import { type KeyboardEvent, useId, useState } from "react";
import { Check } from "lucide-react";

import { input } from "@/components/styles";
import { OUTSIDE_MA, TOWN_COUNTIES } from "@/lib/questions";

import { type TownDraft, searchTowns } from "./drafts";

type Props = {
  draft: TownDraft;
  onChange: (draft: TownDraft) => void;
  labelledBy: string;
  describedBy?: string;
};

/** Type-to-search box over the 351 MA towns, with a shortcut for people outside the state. */
export function TownInput({ draft, onChange, labelledBy, describedBy }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = draft.selected ? [] : searchTowns(draft.query);
  const expanded = open && matches.length > 0;
  const county = draft.selected ? TOWN_COUNTIES[draft.selected] : undefined;

  function choose(town: string) {
    onChange({ query: town, selected: town });
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!expanded) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // pick the town instead of submitting the question
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Type your city or town"
        value={draft.query}
        onChange={(e) => {
          onChange({ query: e.target.value, selected: null });
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={input}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded border border-border-strong bg-card py-1 shadow-sm"
        >
          {matches.map((town, i) => (
            <li
              key={town}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()} // keep focus in the input
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(town)}
              className={`flex cursor-pointer justify-between gap-3 px-3 py-2 text-sm ${
                i === active ? "bg-brand-soft" : ""
              }`}
            >
              <span>{town}</span>
              <span className="text-muted">{TOWN_COUNTIES[town]} County</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm">
        {county ? (
          <span className="flex items-center gap-1 text-success">
            <Check aria-hidden className="size-4" />
            {county} County
          </span>
        ) : (
          <span />
        )}
        {draft.selected !== OUTSIDE_MA && (
          <button type="button" onClick={() => choose(OUTSIDE_MA)} className="text-brand hover:underline">
            I live outside Massachusetts
          </button>
        )}
      </div>
    </div>
  );
}
