"use client";

import { useId, useState } from "react";

type ColumnHelpTipProps = {
  label: string;
  children: string;
};

export function ColumnHelpTip({ label, children }: ColumnHelpTipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 240) });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPos(null);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line bg-card text-[10px] font-medium text-muted hover:border-muted hover:text-ink"
        aria-label={`${label} 설명`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          if (open) hide();
          else show(event.currentTarget);
        }}
        onBlur={hide}
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={hide}
      >
        ?
      </button>
      {open && pos ? (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none fixed z-[600] w-56 rounded-lg border border-line bg-card px-3 py-2 text-left text-[11px] font-normal leading-5 text-ink shadow-sm"
          style={{ top: pos.top, left: pos.left }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
