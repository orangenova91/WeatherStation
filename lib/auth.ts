import { createHash, randomInt, timingSafeEqual } from "crypto";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ws_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  email: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

function secretKey() {
  return new TextEncoder().encode(authSecret());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function passwordError(password: string) {
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (password.length > 72) return "비밀번호는 72자 이하여야 합니다.";
  return null;
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string) {
  return createHash("sha256").update(`${authSecret()}:${code}`).digest("hex");
}

export function codesMatch(code: string, codeHash: string) {
  const next = hashCode(code);
  const left = Buffer.from(next);
  const right = Buffer.from(codeHash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function signSession(session: Session) {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function setSessionCookie(session: Session) {
  const token = await signSession(session);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
