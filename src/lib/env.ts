// Reads a secret from .env.local. A value still holding the "PASTE" placeholder counts as missing.
export function getEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.toUpperCase().startsWith("PASTE")) return null;
  return value;
}
