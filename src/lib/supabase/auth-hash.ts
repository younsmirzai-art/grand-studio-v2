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

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}
