import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";

export default function NotFound() {
  return (
    <PlatformShell user={null}>
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card p-6">
        <h1 className="text-xl font-medium">페이지를 찾을 수 없습니다.</h1>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          공유 지도로 이동
        </Link>
      </div>
    </PlatformShell>
  );
}
