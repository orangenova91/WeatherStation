import { Suspense, type ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { PlatformShell } from "@/components/platform-shell";
import { ShellFallback } from "@/components/shell-fallback";

export function PlatformFrame({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <SessionShell>{children}</SessionShell>
    </Suspense>
  );
}

async function SessionShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  return <PlatformShell user={session ? { email: session.email } : null}>{children}</PlatformShell>;
}
