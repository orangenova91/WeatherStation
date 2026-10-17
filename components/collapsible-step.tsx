"use client";

import { useId, useState, type ReactNode } from "react";

export function CollapsibleStep({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{header}</div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="-my-1 shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-muted hover:bg-paper hover:text-ink"
        >
          {open ? "접기 ▴" : "펼치기 ▾"}
        </button>
      </div>
      <div id={panelId} hidden={!open} className="mt-3 border-t border-line pt-4">
        {children}
      </div>
    </>
  );
}
