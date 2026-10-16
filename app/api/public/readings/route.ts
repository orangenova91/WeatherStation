import { connection } from "next/server";
import { isDatabaseError } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { listPublicMapData } from "@/lib/readings";

export async function GET() {
  await connection();

  try {
    const { readings, stats } = await listPublicMapData();
    return Response.json({ readings, stats });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("수신 목록을 불러오지 못했습니다.", 500);
  }
}
