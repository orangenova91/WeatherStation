import { PlatformFrame } from "@/components/platform-frame";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <PlatformFrame>{children}</PlatformFrame>;
}
