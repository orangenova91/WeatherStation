import { codesMatch, normalizeEmail, setSessionCookie } from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { isDuplicateKey, jsonError, readJson } from "@/lib/http";
import { PendingSignup } from "@/models/PendingSignup";
import { User } from "@/models/User";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return jsonError("이메일과 인증번호가 필요합니다.", 400);
  }

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? normalizeEmail(data.email) : "";
  const code = typeof data.code === "string" ? data.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return jsonError("인증번호 6자리를 입력해 주세요.", 400);
  }

  try {
    await connectDb();
    const pending = await PendingSignup.findOne({ email });
    if (!pending) return jsonError("인증 요청을 찾을 수 없습니다. 다시 가입해 주세요.", 400);
    if (pending.expiresAt.getTime() < Date.now()) {
      await PendingSignup.deleteOne({ email });
      return jsonError("인증번호가 만료되었습니다. 다시 요청해 주세요.", 400);
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      await PendingSignup.deleteOne({ email });
      return jsonError("시도 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.", 400);
    }
    if (!codesMatch(code, pending.codeHash)) {
      pending.attempts += 1;
      await pending.save();
      return jsonError("인증번호가 올바르지 않습니다.", 400);
    }

    const user = await User.create({
      email: pending.email,
      passwordHash: pending.passwordHash,
    });
    await PendingSignup.deleteOne({ email });
    await setSessionCookie({ userId: user._id.toString(), email: user.email });
    return Response.json({ ok: true });
  } catch (error) {
    if (isDuplicateKey(error)) return jsonError("이미 가입된 이메일입니다.", 409);
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("인증을 처리하지 못했습니다.", 500);
  }
}
