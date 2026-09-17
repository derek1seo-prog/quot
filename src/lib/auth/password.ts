// Password hashing for customer portal accounts, and the comparison for the
// hardcoded admin credential. Node-runtime only (uses node:crypto) - never
// import this from middleware.ts, which runs on the Edge runtime.
import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// Deliberately a literal credential, not a real account - explicit product
// decision ("우선" / for now). Compared via fixed-length SHA-256 digests +
// timingSafeEqual so neither a correct username's length nor a partial
// prefix match can be inferred from response timing.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";

function sha256(input: string): Buffer {
  return crypto.createHash("sha256").update(input, "utf8").digest();
}

export function isHardcodedAdmin(username: string, password: string): boolean {
  const userOk = crypto.timingSafeEqual(sha256(username), sha256(ADMIN_USERNAME));
  const passOk = crypto.timingSafeEqual(sha256(password), sha256(ADMIN_PASSWORD));
  return userOk && passOk;
}
