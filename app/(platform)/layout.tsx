import { Suspense, type ReactNode } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { ShellFallback } from "@/components/shell-fallback";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <ProtectedPlatform>{children}</ProtectedPlatform>
    </Suspense>
  );
}

async function ProtectedPlatform({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PlatformShell user={{ email: session.email }}>{children}</PlatformShell>;
}
