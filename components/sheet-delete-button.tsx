"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SheetDeleteButtonProps = {
  sheetId: string;
  sheetName: string;
  /** list: 목록에서 링크 클릭과 분리 / detail: 상세 헤더 */
  variant?: "list" | "detail";
};

export function SheetDeleteButton({ sheetId, sheetName, variant = "detail" }: SheetDeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const confirmed = window.confirm(
      `"${sheetName}" 시트와 수신 기록을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`,
    );
    if (!confirmed) return;

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/sheets/${sheetId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "시트를 삭제하지 못했습니다.");
        setPending(false);
        return;
      }
      if (variant === "detail") {
        router.push("/sheets");
      }
      router.refresh();
    } catch {
      setError("시트를 삭제하지 못했습니다.");
      setPending(false);
    }
  }

  return (
    <div className={variant === "list" ? "shrink-0" : undefined}>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={
          variant === "list"
            ? "rounded-md border border-line px-2.5 py-1.5 text-xs text-danger hover:bg-paper disabled:opacity-60"
            : "rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-paper disabled:opacity-60"
        }
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {error ? <p className={`mt-1 text-xs text-danger ${variant === "list" ? "text-right" : ""}`}>{error}</p> : null}
    </div>
  );
}
