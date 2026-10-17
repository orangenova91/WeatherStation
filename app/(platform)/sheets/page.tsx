import Link from "next/link";
import { Suspense } from "react";
import { ColumnHelpTip } from "@/components/column-help-tip";
import { SheetCreateForm } from "@/components/sheet-create-form";
import { SheetDeleteButton } from "@/components/sheet-delete-button";
import { SheetShareToggle } from "@/components/sheet-share-toggle";
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
  if (names.length === 0) return "—";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}곳`;
}

function FreshBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink"
      style={{
        background: "rgba(216,154,43,.22)",
        boxShadow: "inset 0 0 0 1px rgba(216,154,43,.55)",
      }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#d89a2b" }} />
      수신 중
    </span>
  );
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
      sharedOnMap: sheet.sharedOnMap !== false,
    }));
    sheets = await attachSheetReadingSummaries(base);
  } catch (error) {
    console.error(error);
    offline = true;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-medium md:text-2xl">Data 서버 만들기</h1>
        <p className="mt-1 text-sm text-muted">
          기기에서 보낼 데이터베이스 시트를 만듭니다. 공유 지도 표시는 시트마다 끌 수 있습니다.
        </p>
      </div>
      <SheetCreateForm />
      {offline ? (
        <p className="text-sm text-danger">데이터베이스에 연결할 수 없습니다.</p>
      ) : sheets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-sm text-muted">
          아직 시트가 없습니다.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-card">
          <ul className="divide-y divide-line md:hidden">
            {sheets.map((sheet) => (
              <li key={sheet.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/sheets/${sheet.id}`}
                      className="break-all font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {sheet.name}
                    </Link>
                    {sheet.totalReadings > 0 && sheet.isFresh ? <FreshBadge /> : null}
                  </div>
                  <SheetDeleteButton sheetId={sheet.id} sheetName={sheet.name} variant="list" />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted">위치</dt>
                  <dd>{formatLocationNames(sheet.locationNames)}</dd>
                  <dt className="text-muted">관측</dt>
                  <dd className="font-mono">
                    {sheet.totalReadings > 0 ? `${formatCount(sheet.totalReadings)}회` : "0회"}
                  </dd>
                  <dt className="text-muted">마지막 수신</dt>
                  <dd className="font-mono">
                    {sheet.lastReceivedAt
                      ? formatReceivedAt(sheet.lastReceivedAt, false, LIST_TIME_ZONE)
                      : "—"}
                  </dd>
                  <dt className="text-muted">생성일</dt>
                  <dd className="font-mono">{formatReceivedAt(sheet.createdAt, false, LIST_TIME_ZONE)}</dd>
                </dl>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-xs">
                  <ColumnHelpTip label="지도 공유">
                    켜면 이 시트 관측이 홈 공유 지도에 표시됩니다. 꺼도 수신·시트 상세·CSV는 그대로 남습니다.
                  </ColumnHelpTip>
                  <SheetShareToggle sheetId={sheet.id} initialSharedOnMap={sheet.sharedOnMap} variant="list" />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">시트 이름</th>
                  <th className="px-4 py-3 font-medium">위치</th>
                  <th className="px-4 py-3 font-medium">관측</th>
                  <th className="px-4 py-3 font-medium">마지막 수신</th>
                  <th className="px-4 py-3 font-medium text-center">
                    <ColumnHelpTip label="지도 공유">
                      켜면 이 시트 관측이 홈 공유 지도에 표시됩니다. 꺼도 수신·시트 상세·CSV는 그대로 남습니다.
                    </ColumnHelpTip>
                  </th>
                  <th className="px-4 py-3 font-medium">생성일</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => (
                  <tr key={sheet.id} className="border-t border-line hover:bg-paper/70">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/sheets/${sheet.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                          {sheet.name}
                        </Link>
                        {sheet.totalReadings > 0 && sheet.isFresh ? <FreshBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatLocationNames(sheet.locationNames)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {sheet.totalReadings > 0 ? `${formatCount(sheet.totalReadings)}회` : "0회"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {sheet.lastReceivedAt
                        ? formatReceivedAt(sheet.lastReceivedAt, false, LIST_TIME_ZONE)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SheetShareToggle sheetId={sheet.id} initialSharedOnMap={sheet.sharedOnMap} variant="list" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {formatReceivedAt(sheet.createdAt, false, LIST_TIME_ZONE)}
                    </td>
                    <td className="px-4 py-3">
                      <SheetDeleteButton sheetId={sheet.id} sheetName={sheet.name} variant="list" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
