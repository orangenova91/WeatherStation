import { getSession } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { isObjectId } from "@/lib/tokens";
import { Reading } from "@/models/Reading";
import { Sheet } from "@/models/Sheet";

export async function PATCH(request: Request, ctx: RouteContext<"/api/sheets/[id]">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  const body = await readJson(request);
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { sharedOnMap?: unknown }).sharedOnMap !== "boolean"
  ) {
    return jsonError("sharedOnMap 값이 필요합니다.", 400);
  }
  const sharedOnMap = (body as { sharedOnMap: boolean }).sharedOnMap;

  try {
    await connectDb();
    const sheet = await Sheet.findOneAndUpdate(
      { _id: id, ownerId: session.userId },
      { sharedOnMap },
      { new: true },
    );
    if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);
    return Response.json({ sharedOnMap: sheet.sharedOnMap !== false });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("공유 설정을 바꾸지 못했습니다.", 500);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/sheets/[id]">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  try {
    await connectDb();
    const sheet = await Sheet.findOneAndDelete({ _id: id, ownerId: session.userId });
    if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);

    await Reading.deleteMany({ sheetId: id });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("시트를 삭제하지 못했습니다.", 500);
  }
}
