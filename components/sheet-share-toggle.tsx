"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SheetShareToggleProps = {
  sheetId: string;
  initialSharedOnMap: boolean;
  variant?: "list" | "detail";
};

export function SheetShareToggle({
  sheetId,
  initialSharedOnMap,
  variant = "list",
}: SheetShareToggleProps) {
  const router = useRouter();
  const [shared, setShared] = useState(initialSharedOnMap);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onToggle(event: React.MouseEvent | React.ChangeEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const next = !shared;

    setPending(true);
    setError("");
    const previous = shared;
    setShared(next);
    try {
      const response = await fetch(`/api/sheets/${sheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedOnMap: next }),
      });
      const data = (await response.json()) as { error?: string; sharedOnMap?: boolean };
      if (!response.ok || typeof data.sharedOnMap !== "boolean") {
        setShared(previous);
        setError(data.error ?? "공유 설정을 바꾸지 못했습니다.");
        setPending(false);
        return;
      }
      setShared(data.sharedOnMap);
      setPending(false);
      router.refresh();
    } catch {
      setShared(previous);
      setError("공유 설정을 바꾸지 못했습니다.");
      setPending(false);
    }
  }

  const stateLabel = shared ? "지도에 표시 중" : "지도에서 숨김";

  return (
    <div
      className={variant === "list" ? "shrink-0" : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={shared}
        aria-label={`공유 지도: ${stateLabel}`}
        title={stateLabel}
        disabled={pending}
        onClick={onToggle}
        className="inline-flex items-center rounded-md p-0.5 disabled:opacity-60"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            shared ? "bg-accent" : "bg-line"
          } ${pending ? "opacity-70" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              shared ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
