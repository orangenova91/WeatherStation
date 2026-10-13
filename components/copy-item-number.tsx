"use client";

import { useState } from "react";

export function CopyItemNumber({ value, compact = false }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setError("복사하지 못했습니다.");
    }
  }

  return (
    <div className={compact ? "inline-flex items-center" : "flex flex-col items-start gap-2"}>
      <button
        type="button"
        onClick={copy}
        className={
          compact
            ? "rounded-md bg-sidebar px-2 py-1 text-[11px] text-white"
            : "rounded-md bg-sidebar px-3 py-2 text-sm text-white"
        }
      >
        {copied ? "복사됨" : compact ? "복사하기" : "물품번호 복사하기"}
      </button>
      {error ? <p className={compact ? "text-[11px] text-danger" : "text-sm text-danger"}>{error}</p> : null}
    </div>
  );
}
