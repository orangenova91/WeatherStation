"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "인증번호를 보내지 못했습니다.");
      return;
    }
    setStep("code");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "인증에 실패했습니다.");
      return;
    }
    router.push("/sheets");
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <h1 className="text-xl font-medium">이메일 인증</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {email} 로 보낸 인증번호 6자리를 입력해 주세요. 개발 중 SMTP를 비워 두면 인증번호가 서버 로그에
          출력됩니다.
        </p>
        <label className="mt-6 block text-sm" htmlFor="code">
          인증번호
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-base tracking-[0.3em] outline-none focus:border-accent md:text-sm"
        />
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-sidebar px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "확인 중…" : "가입 완료"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => requestCode()}
          className="mt-3 w-full rounded-md border border-line px-4 py-2 text-sm disabled:opacity-60"
        >
          인증번호 다시 보내기
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card p-6">
      <h1 className="text-xl font-medium">가입</h1>
      <p className="mt-2 text-sm text-muted">이메일로 인증번호를 받은 뒤 계정이 만들어집니다.</p>
      <label className="mt-6 block text-sm" htmlFor="email">
        이메일
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
      />
      <label className="mt-4 block text-sm" htmlFor="password">
        비밀번호
      </label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
      />
      <p className="mt-1 text-xs text-muted">8자 이상</p>
      <label className="mt-4 block text-sm" htmlFor="confirmPassword">
        비밀번호 확인
      </label>
      <input
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
      />
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-md bg-sidebar px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {pending ? "보내는 중…" : "인증번호 받기"}
      </button>
    </form>
  );
}
