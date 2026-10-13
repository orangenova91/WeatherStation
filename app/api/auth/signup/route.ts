import {
  generateCode,
  hashCode,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  passwordError,
} from "@/lib/auth";
import { connectDb, isDatabaseError } from "@/lib/db";
import { isDuplicateKey, jsonError, readJson } from "@/lib/http";
import { sendVerificationCode } from "@/lib/mail";
import { PendingSignup } from "@/models/PendingSignup";
import { User } from "@/models/User";

const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") {
    return jsonError("이메일과 비밀번호가 필요합니다.", 400);
  }

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? normalizeEmail(data.email) : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!isValidEmail(email)) return jsonError("이메일 형식을 확인해 주세요.", 400);
  const invalidPassword = passwordError(password);
  if (invalidPassword) return jsonError(invalidPassword, 400);

  try {
    await connectDb();
    const existing = await User.findOne({ email });
    if (existing) return jsonError("이미 가입된 이메일입니다.", 409);

    const code = generateCode();
    await PendingSignup.findOneAndUpdate(
      { email },
      {
        email,
        passwordHash: await hashPassword(password),
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        attempts: 0,
      },
      { upsert: true },
    );

    try {
      await sendVerificationCode(email, code);
    } catch (error) {
      console.error(error);
      return jsonError("인증 메일을 보내지 못했습니다.", 502);
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (isDuplicateKey(error)) return jsonError("이미 가입된 이메일입니다.", 409);
    console.error(error);
    if (isDatabaseError(error)) {
      return jsonError("데이터베이스에 연결할 수 없습니다.", 503);
    }
    return jsonError("가입 요청을 처리하지 못했습니다.", 500);
  }
}
