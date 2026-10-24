"use client";

import { useRef, type KeyboardEvent } from "react";

import { controlTransition, focusRing } from "@/components/styles";

export type GlassTab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  /** Prefix for tab/panel ids; use tabPanelProps() with the same value on each panel. */
  idBase: string;
  tabs: GlassTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
};

export function tabId(idBase: string, id: string) {
  return `${idBase}-tab-${id}`;
}

export function tabPanelProps(idBase: string, id: string) {
  return {
    id: `${idBase}-panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": tabId(idBase, id),
    tabIndex: 0,
  };
}

/** Segmented tabs with roving focus (arrow keys, Home, End). */
export function GlassTabs<T extends string>({
  idBase,
  tabs,
  value,
  onChange,
  label,
  className = "",
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`glass-inset flex w-full gap-1 rounded-[1.25rem] p-1 sm:inline-flex sm:w-auto sm:rounded-full ${className}`}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idBase, tab.id)}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            // On phones long labels wrap to two lines (a pill would clip them); from sm up they stay on one.
            className={`min-h-9 flex-1 rounded-2xl px-2.5 py-1.5 text-[0.8125rem] font-semibold leading-tight sm:flex-none sm:whitespace-nowrap sm:rounded-full sm:px-4 sm:py-0 sm:text-sm ${focusRing} ${controlTransition} ${
              selected
                ? "bg-white text-ink shadow-[inset_0_1px_0_rgb(255_255_255),0_4px_12px_-6px_rgb(23_36_71/0.3)]"
                : "text-ink-soft hover:bg-white/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
