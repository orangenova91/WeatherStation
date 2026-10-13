import { connectDb, isDatabaseError } from "@/lib/db";
import { parseIngestBody } from "@/lib/ingest";
import { jsonError, readJson } from "@/lib/http";
import { createReading } from "@/lib/readings";
import { publishReading } from "@/lib/realtime";
import { Sheet } from "@/models/Sheet";

export async function POST(request: Request, ctx: RouteContext<"/api/ingest/[token]">) {
  const { token } = await ctx.params;
  if (!token) return jsonError("송신 주소를 찾을 수 없습니다.", 404);

  const parsed = parseIngestBody(await readJson(request));
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    await connectDb();
    const sheet = await Sheet.findOne({ ingestToken: token });
    if (!sheet) return jsonError("송신 주소를 찾을 수 없습니다.", 404);

    const reading = await createReading(sheet._id.toString(), parsed.value);
    publishReading(sheet._id.toString(), reading);
    return Response.json({ ok: true, id: reading.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("수신 값을 저장하지 못했습니다.", 500);
  }
}
