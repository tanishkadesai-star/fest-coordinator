// Server-only helpers for the codes and tokens people use to get in.
import { randomBytes } from "node:crypto";

// No 0/O/1/I so codes are easy to read out over a walkie-talkie.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// A private token: proof of who you are for powers like assigning tasks and publishing files.
export function newToken(): string {
  return randomBytes(16).toString("hex");
}
