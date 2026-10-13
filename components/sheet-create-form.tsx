"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SheetCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json()) as { error?: string; sheet?: { id: string } };
    setPending(false);
    if (!response.ok || !data.sheet) {
      setError(data.error ?? "시트를 만들지 못했습니다.");
      return;
    }
    router.push(`/sheets/${data.sheet.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-medium">시트 만들기</h2>
      <p className="mt-1 text-sm text-muted">시트를 만들면 그 시트로만 값을 보내는 주소가 생깁니다.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="sheet-name">
          시트 이름
        </label>
        <input
          id="sheet-name"
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="시트 이름"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-sidebar px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "만드는 중…" : "만들기"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
