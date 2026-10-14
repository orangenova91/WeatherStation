import { getSession } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { countSheetReadings, listSheetReadings } from "@/lib/readings";
import { isObjectId } from "@/lib/tokens";
import { Sheet } from "@/models/Sheet";

export async function GET(_request: Request, ctx: RouteContext<"/api/sheets/[id]/readings">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  try {
    await connectDb();
    const sheet = await Sheet.findOne({ _id: id, ownerId: session.userId });
    if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);
    const [readings, total] = await Promise.all([listSheetReadings(id), countSheetReadings(id)]);
    return Response.json({ readings, total });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("수신 기록을 불러오지 못했습니다.", 500);
  }
}
