import { NextResponse } from "next/server";

const EPIC_AUTHORIZE_URL = "https://www.epicgames.com/id/authorize";
const SCOPE = "basic_profile";

export async function GET(request: Request) {
  const clientId = process.env.EPIC_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/auth/epic?error=Epic+login+is+not+configured", request.url)
    );
  }

  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isDev = process.env.NODE_ENV === "development";
  const baseUrl = isDev ? origin : `https://${forwardedHost || new URL(origin).host}`;
  const redirectUri = `${baseUrl}/auth/epic/callback`;

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `${EPIC_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
