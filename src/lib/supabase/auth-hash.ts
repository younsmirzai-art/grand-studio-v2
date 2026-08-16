export type ImplicitSessionTokens = {
  access_token: string;
  refresh_token: string;
  type: string | null;
};

export function parseAuthHash(hash: string): ImplicitSessionTokens | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return {
    access_token,
    refresh_token,
    type: params.get("type"),
  };
}

export function decodeAuthErrorParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

export function getEmailRedirectTo(path: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const origin =
    fromEnv ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://grandstudio.dev");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/browse";
  }
  if (value === "/dashboard" || value.startsWith("/dashboard/")) {
    return "/browse";
  }
  return value;
}
