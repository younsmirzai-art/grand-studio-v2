/**
 * Base URL for server-side calls to this app's own API routes (Poly Haven / Sketchfab search, etc.).
 * Use NEXT_PUBLIC_SITE_URL in production; localhost in dev; Vercel preview URL when set.
 */
export function getInternalSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return "https://grandstudio.dev";
}
