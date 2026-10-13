import Link from "next/link";
import { Suspense } from "react";
import { SheetCreateForm } from "@/components/sheet-create-form";
import { getSession } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Sheet } from "@/models/Sheet";
import { redirect } from "next/navigation";

export const metadata = { title: "Data 서버 만들기" };

export default function SheetsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">시트를 불러오는 중…</p>}>
      <SheetsContent />
    </Suspense>
  );
}

async function SheetsContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  let sheets: Array<{ id: string; name: string; createdAt: string }> = [];
  let offline = false;
  try {
    await connectDb();
    const docs = await Sheet.find({ ownerId: session.userId }).sort({ createdAt: -1 });
    sheets = docs.map((sheet) => ({
      id: sheet._id.toString(),
      name: sheet.name,
      createdAt: sheet.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error(error);
    offline = true;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-medium">Data 서버 만들기</h1>
        <p className="mt-1 text-sm text-muted">기기에서 보낼 데이터베이스 시트를 만듭니다.</p>
      </div>
      <SheetCreateForm />
      {offline ? (
        <p className="text-sm text-danger">데이터베이스에 연결할 수 없습니다.</p>
      ) : sheets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-sm text-muted">
          아직 시트가 없습니다.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {sheets.map((sheet) => (
            <li key={sheet.id} className="border-b border-line last:border-b-0">
              <Link href={`/sheets/${sheet.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper">
                <span className="font-medium">{sheet.name}</span>
                <span className="text-xs text-muted">
                  {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(sheet.createdAt),
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
