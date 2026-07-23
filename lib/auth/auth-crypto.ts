import "server-only";

import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const OTP_KEY_LENGTH = 32;

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function hashOtpCode(code: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(code, salt, OTP_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyOtpCode(code: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== OTP_KEY_LENGTH) return false;
  const actual = (await scrypt(code, salt, OTP_KEY_LENGTH)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
