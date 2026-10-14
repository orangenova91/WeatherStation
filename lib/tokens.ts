const INGEST_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const INGEST_TOKEN_LENGTH = 12;

export function normalizeIngestToken(value: string) {
  return value.replace(/-/g, "").toUpperCase();
}

export function formatIngestToken(value: string) {
  return normalizeIngestToken(value).replace(/(.{4})(?=.)/g, "$1-");
}

export function newIngestToken() {
  const alphabetSize = INGEST_ALPHABET.length;
  const limit = Math.floor(256 / alphabetSize) * alphabetSize;
  let token = "";

  while (token.length < INGEST_TOKEN_LENGTH) {
    const bytes = new Uint8Array(INGEST_TOKEN_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      token += INGEST_ALPHABET[byte % alphabetSize];
      if (token.length === INGEST_TOKEN_LENGTH) break;
    }
  }

  return token;
}

export function isObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}
