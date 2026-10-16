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
    if (
      !next &&
      !window.confirm("공유 지도에서 이 시트 관측을 숨깁니다. 수신 기록은 그대로 남습니다. 계속할까요?")
    ) {
      return;
    }

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

  const label = shared ? "지도에 표시" : "지도에서 숨김";

  return (
    <div
      className={variant === "list" ? "shrink-0" : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={shared}
        aria-label={`공유 지도 ${label}`}
        disabled={pending}
        onClick={onToggle}
        className={
          variant === "detail"
            ? "inline-flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2 text-sm disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs disabled:opacity-60"
        }
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            shared ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              shared ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
        <span className="text-muted">{pending ? "저장 중…" : label}</span>
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
