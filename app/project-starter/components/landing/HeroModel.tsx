"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import type { ModelFrame } from "@/components/landing/ModelCanvas";
import { controlTransition, focusRing } from "@/components/styles";

const ModelCanvas = dynamic(() => import("@/components/landing/ModelCanvas"), {
  ssr: false,
});

const DESCRIPTION =
  "An older man in a knitted blue hat rests in an armchair while receiving an IV infusion. " +
  "A care provider in a blue jacket stands beside him with a hand on his arm. They are on a " +
  "round patterned rug next to a small side table with a mug and a plant.";

/** Space kept under the model for the drag hint / reset control. */
const CONTROL_SPACE = 48;

class ModelErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const chip =
  "inline-flex items-center gap-2 rounded-control bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line";

function sameFrame(a: ModelFrame | null, b: ModelFrame) {
  return (
    !!a &&
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

type Props = {
  /** id of an element marking where the model should sit; the canvas may extend beyond it. */
  slotId?: string;
  className?: string;
};

export function HeroModel({ slotId, className = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [frame, setFrame] = useState<ModelFrame | null>(null);

  const handleReady = useCallback(() => setStatus("ready"), []);
  const handleError = useCallback(() => setStatus("error"), []);
  const handleInteract = useCallback(() => setInteracted(true), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const slot = slotId ? document.getElementById(slotId) : null;

    const measure = () => {
      const outer = root.getBoundingClientRect();
      const inner = slot?.getBoundingClientRect();
      const next: ModelFrame =
        inner && inner.width > 0 && inner.height > 0
          ? {
              x: inner.left - outer.left,
              y: inner.top - outer.top,
              width: inner.width,
              height: Math.max(inner.height - CONTROL_SPACE, 120),
            }
          : { x: 0, y: 0, width: outer.width, height: Math.max(outer.height - CONTROL_SPACE, 120) };
      setFrame((prev) => (sameFrame(prev, next) ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (slot) observer.observe(slot);
    return () => observer.disconnect();
  }, [slotId]);

  const controlsTop = frame ? frame.y + frame.height + 4 : undefined;

  return (
    <div ref={rootRef} className={`enter-model ${className}`}>
      {frame ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[50%] bg-[radial-gradient(closest-side,rgb(27_26_23/0.06),transparent)]"
          style={{
            left: frame.x + frame.width * 0.12,
            width: frame.width * 0.76,
            top: frame.y + frame.height * 0.62,
            height: frame.height * 0.4,
          }}
        />
      ) : null}

      {status !== "error" ? (
        <div
          role="img"
          aria-label="Interactive 3D scene of a patient receiving care. Drag to rotate."
          aria-describedby="hero-model-description"
          className={`absolute inset-0 transition-opacity duration-500 ease-out ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        >
          <ModelErrorBoundary onError={handleError}>
            <ModelCanvas
              frame={frame}
              onReady={handleReady}
              onProgress={setProgress}
              onInteract={handleInteract}
              resetSignal={resetSignal}
            />
          </ModelErrorBoundary>
        </div>
      ) : null}
      <p id="hero-model-description" className="sr-only">
        {DESCRIPTION}
      </p>

      {status !== "ready" && frame ? (
        <div
          role="status"
          className="absolute grid place-items-center px-6 text-center"
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
        >
          {status === "loading" ? (
            <span className={chip}>Loading 3D scene{progress > 0 ? ` · ${progress}%` : "…"}</span>
          ) : (
            <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
              The 3D scene couldn’t load. {DESCRIPTION}
            </p>
          )}
        </div>
      ) : null}

      {status === "ready" && frame ? (
        <div
          className="pointer-events-none absolute flex justify-center"
          style={{ left: frame.x, width: frame.width, top: controlsTop } as CSSProperties}
        >
          <span
            aria-hidden
            className={`${chip} transition-opacity duration-300 ${interacted ? "opacity-0" : "opacity-100"}`}
          >
            <DragIcon />
            Drag to explore
          </span>
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className={`${chip} ${focusRing} ${controlTransition} pointer-events-auto absolute top-0 hover:bg-sunken hover:text-ink focus-visible:opacity-100 ${
              interacted ? "opacity-100" : "opacity-0"
            }`}
          >
            <ResetIcon />
            Reset view
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 8h12M2 8l2.5-2.5M2 8l2.5 2.5M14 8l-2.5-2.5M14 8l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
