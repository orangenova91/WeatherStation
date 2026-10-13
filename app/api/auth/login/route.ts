import { normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { PendingSignup } from "@/models/PendingSignup";
import { User } from "@/models/User";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return jsonError("이메일과 비밀번호가 필요합니다.", 400);
  }

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? normalizeEmail(data.email) : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!email || !password) return jsonError("이메일과 비밀번호가 필요합니다.", 400);

  try {
    await connectDb();
    const user = await User.findOne({ email });
    if (!user) {
      const pending = await PendingSignup.findOne({ email });
      if (pending) {
        return jsonError("이메일 인증이 끝나지 않았습니다. 가입 화면에서 인증번호를 입력해 주세요.", 403);
      }
      return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
    }

    const matches = await verifyPassword(password, user.passwordHash);
    if (!matches) return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);

    await setSessionCookie({ userId: user._id.toString(), email: user.email });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("로그인에 실패했습니다.", 500);
  }
}
