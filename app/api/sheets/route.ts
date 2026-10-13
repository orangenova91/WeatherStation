import { getSession } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { newIngestToken } from "@/lib/tokens";
import { Sheet } from "@/models/Sheet";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  try {
    await connectDb();
    const sheets = await Sheet.find({ ownerId: session.userId }).sort({ createdAt: -1 });
    return Response.json({
      sheets: sheets.map((sheet) => ({
        id: sheet._id.toString(),
        name: sheet.name,
        createdAt: sheet.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("시트 목록을 불러오지 못했습니다.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson(request);
  const name = body && typeof body === "object" && typeof (body as { name?: unknown }).name === "string"
    ? (body as { name: string }).name.trim()
    : "";
  if (!name || name.length > 60) {
    return jsonError("시트 이름은 1자에서 60자 사이여야 합니다.", 400);
  }

  try {
    await connectDb();
    const sheet = await Sheet.create({
      ownerId: session.userId,
      name,
      ingestToken: newIngestToken(),
    });
    return Response.json(
      {
        sheet: {
          id: sheet._id.toString(),
          name: sheet.name,
          ingestToken: sheet.ingestToken,
          createdAt: sheet.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("시트를 만들지 못했습니다.", 500);
  }
}
