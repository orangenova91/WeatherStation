import { randomBytes } from "crypto";

export function newIngestToken() {
  return randomBytes(24).toString("base64url");
}

export function isObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}
