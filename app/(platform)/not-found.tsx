import Link from "next/link";

export default function PlatformNotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card p-6">
      <h1 className="text-xl font-medium">시트를 찾을 수 없습니다.</h1>
      <p className="mt-2 text-sm text-muted">주소가 바뀌었거나 다른 계정의 시트입니다.</p>
      <Link href="/sheets" className="mt-4 inline-block text-sm underline">
        내 시트로 돌아가기
      </Link>
    </div>
  );
}
