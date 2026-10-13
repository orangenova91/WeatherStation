import { getSession } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { subscribeReadings } from "@/lib/realtime";
import { isObjectId } from "@/lib/tokens";
import type { ReadingView } from "@/lib/types";
import { Sheet } from "@/models/Sheet";

export async function GET(request: Request, ctx: RouteContext<"/api/sheets/[id]/stream">) {
  const session = await getSession();
  if (!session) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await ctx.params;
  if (!isObjectId(id)) return jsonError("시트를 찾을 수 없습니다.", 404);

  try {
    await connectDb();
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("실시간 수신을 시작하지 못했습니다.", 500);
  }

  const sheet = await Sheet.findOne({ _id: id, ownerId: session.userId });
  if (!sheet) return jsonError("시트를 찾을 수 없습니다.", 404);

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    unsubscribe();
    unsubscribe = () => {};
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      send("retry: 3000\n\n");
      unsubscribe = subscribeReadings(id, (reading: ReadingView) => {
        try {
          send(`data: ${JSON.stringify(reading)}\n\n`);
        } catch {
          stop();
        }
      });
      timer = setInterval(() => {
        try {
          send(": ping\n\n");
        } catch {
          stop();
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
