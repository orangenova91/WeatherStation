import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

const sketchPath = path.join(process.cwd(), "arduino_ide", "weather_station", "weather_station.ino");

export async function GET() {
  await connection();

  try {
    const body = await readFile(sketchPath);
    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="weather_station.ino"',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("스케치 파일을 찾지 못했습니다.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
