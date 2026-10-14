import { getSession } from "@/lib/auth";
import { attachmentDisposition, csvFilename, readingsToCsv } from "@/lib/csv";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { listAllSheetReadings } from "@/lib/readings";
import { isObjectId } from "@/lib/tokens";
import { resolveTimeZone } from "@/lib/time";
import { Sheet } from "@/models/Sheet";

export async function GET(request: Request, ctx: RouteContext<"/api/sheets/[id]/export">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  try {
    await connectDb();
    const sheet = await Sheet.findOne({ _id: id, ownerId: session.userId });
    if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);
    const readings = await listAllSheetReadings(id);
    const timeZone = resolveTimeZone(new URL(request.url).searchParams.get("timeZone"));
    return new Response(readingsToCsv(readings, timeZone), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachmentDisposition(csvFilename(sheet.name, new Date(), timeZone)),
      },
    });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("수신 기록을 내려받지 못했습니다.", 500);
  }
}
