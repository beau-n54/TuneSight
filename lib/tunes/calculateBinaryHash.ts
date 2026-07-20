import crypto from "crypto";

export function calculateBinaryHash(
  buffer: Buffer
): string {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}