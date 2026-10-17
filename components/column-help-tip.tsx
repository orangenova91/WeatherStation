"use client";

import { useEffect, useId, useRef, useState } from "react";

type ColumnHelpTipProps = {
  label: string;
  children: string;
};

export function ColumnHelpTip({ label, children }: ColumnHelpTipProps) {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show(anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)) });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPos(null);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPos(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className="group -m-2 inline-flex items-center justify-center p-2"
        aria-label={`${label} 설명`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          if (open) hide();
          else show(event.currentTarget);
        }}
        onBlur={hide}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show(event.currentTarget);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") hide();
        }}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line bg-card text-[10px] font-medium text-muted group-hover:border-muted group-hover:text-ink">
          ?
        </span>
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
