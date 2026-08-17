import * as Crypto from "expo-crypto";

/**
 * Hash a raw phone number for contact matching.
 * Normalises to 10-digit US format before hashing
 * (strips a leading country code "1" from 11-digit numbers).
 */
export async function hashPhone(rawNumber: string): Promise<string> {
  const digits = rawNumber.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length < 7) return "";
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}
