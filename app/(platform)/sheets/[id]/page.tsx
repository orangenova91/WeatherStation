import { Suspense } from "react";
import { SheetLive } from "@/components/sheet-live";
import { getSession } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { listSheetReadings } from "@/lib/readings";
import { isObjectId } from "@/lib/tokens";
import type { ReadingView } from "@/lib/types";
import { Sheet } from "@/models/Sheet";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "시트 수신" };

export default function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">시트를 불러오는 중…</p>}>
      <SheetDetail params={params} />
    </Suspense>
  );
}

async function SheetDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!isObjectId(id)) notFound();

  let sheetView: { name: string; ingestToken: string; readings: ReadingView[] } | null = null;
  let offline = false;
  try {
    await connectDb();
    const sheet = await Sheet.findOne({ _id: id, ownerId: session.userId });
    if (sheet) {
      sheetView = {
        name: sheet.name,
        ingestToken: sheet.ingestToken,
        readings: await listSheetReadings(id),
      };
    }
  } catch (error) {
    console.error(error);
    offline = true;
  }

  if (offline) {
    return <p className="text-sm text-danger">데이터베이스에 연결할 수 없습니다.</p>;
  }
  if (!sheetView) notFound();

  return (
    <SheetLive
      sheetId={id}
      name={sheetView.name}
      ingestToken={sheetView.ingestToken}
      initialReadings={sheetView.readings}
    />
  );
}
