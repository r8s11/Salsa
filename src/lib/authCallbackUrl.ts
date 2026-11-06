// Shared canonical callback for all browser-based Supabase auth flows.
const PRODUCTION_ORIGIN = "https://www.salsasegura.com";
const LOCAL_ORIGINS = new Set([
  "http://localhost:5173", "http://localhost:3000",
  "http://127.0.0.1:5173", "http://127.0.0.1:3000",
]);

export function getCallbackUrl(): string {
  const origin = window.location.origin;
  return `${LOCAL_ORIGINS.has(origin) ? origin : PRODUCTION_ORIGIN}/auth/callback`;
}
