import { getSession } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { isObjectId, newIngestToken } from "@/lib/tokens";
import { Sheet } from "@/models/Sheet";

export async function POST(_request: Request, ctx: RouteContext<"/api/sheets/[id]/rotate-token">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  try {
    await connectDb();
    const sheet = await Sheet.findOneAndUpdate(
      { _id: id, ownerId: session.userId },
      { ingestToken: newIngestToken() },
      { new: true },
    );
    if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);
    return Response.json({ ingestToken: sheet.ingestToken });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("송신 주소를 재발급하지 못했습니다.", 500);
  }
}
