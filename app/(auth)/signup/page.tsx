import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "가입" };

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">가입 화면을 준비하는 중…</p>}>
      <SignupGate />
    </Suspense>
  );
}

async function SignupGate() {
  const session = await getSession();
  if (session) redirect("/sheets");
  return <SignupForm />;
}
