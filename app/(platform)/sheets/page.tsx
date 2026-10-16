import Link from "next/link";
import { Suspense } from "react";
import { SheetCreateForm } from "@/components/sheet-create-form";
import { getSession } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { attachSheetReadingSummaries } from "@/lib/readings";
import { formatReceivedAt } from "@/lib/time";
import type { SheetSummary } from "@/lib/types";
import { Sheet } from "@/models/Sheet";
import { redirect } from "next/navigation";

export const metadata = { title: "Data 서버 만들기" };

const LIST_TIME_ZONE = "Asia/Seoul";

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatLocationNames(names: string[]) {
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}곳`;
}

function SheetListMeta({ sheet }: { sheet: SheetSummary }) {
  if (sheet.totalReadings === 0) return null;

  const location = formatLocationNames(sheet.locationNames);
  const parts = [
    location,
    `${formatCount(sheet.totalReadings)}회`,
    sheet.lastReceivedAt
      ? `마지막 수신 ${formatReceivedAt(sheet.lastReceivedAt, false, LIST_TIME_ZONE)}`
      : null,
  ].filter(Boolean);

  return <p className="mt-1 text-xs leading-5 text-muted">{parts.join(" · ")}</p>;
}

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

  let sheets: SheetSummary[] = [];
  let offline = false;
  try {
    await connectDb();
    const docs = await Sheet.find({ ownerId: session.userId }).sort({ createdAt: -1 });
    const base = docs.map((sheet) => ({
      id: sheet._id.toString(),
      name: sheet.name,
      createdAt: sheet.createdAt.toISOString(),
    }));
    sheets = await attachSheetReadingSummaries(base);
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
              <Link
                href={`/sheets/${sheet.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sheet.name}</span>
                    {sheet.totalReadings > 0 && sheet.isFresh ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink"
                        style={{ background: "rgba(216,154,43,.22)", boxShadow: "inset 0 0 0 1px rgba(216,154,43,.55)" }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: "#d89a2b" }}
                        />
                        수신 중
                      </span>
                    ) : null}
                  </div>
                  <SheetListMeta sheet={sheet} />
                </div>
                <span className="shrink-0 text-xs text-muted">
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
