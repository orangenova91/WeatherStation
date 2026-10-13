import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">로그인 화면을 준비하는 중…</p>}>
      <LoginGate />
    </Suspense>
  );
}

async function LoginGate() {
  const session = await getSession();
  if (session) redirect("/sheets");
  return <LoginForm />;
}
