import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const EPIC_TOKEN_URL = "https://api.epicgames.dev/epic/oauth/v2/token";
const EPIC_USER_URL = "https://api.epicgames.dev/epic/oauth/v2/userInfo";

function getBaseUrl(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isDev = process.env.NODE_ENV === "development";
  return isDev ? origin : `https://${forwardedHost || new URL(origin).host}`;
}

async function exchangeCodeForEpicToken(
  code: string,
  redirectUri: string
): Promise<{ account_id: string; display_name?: string } | null> {
  const clientId = process.env.EPIC_CLIENT_ID;
  const clientSecret = process.env.EPIC_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(EPIC_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { account_id?: string };
  const accountId = data.account_id;
  if (!accountId) return null;

  const accessToken = (data as { access_token?: string }).access_token;
  let displayName: string | undefined;
  if (accessToken) {
    try {
      const userRes = await fetch(EPIC_USER_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const userData = (await userRes.json()) as { displayName?: string };
        displayName = userData.displayName;
      }
    } catch {
      // ignore
    }
  }

  return { account_id: accountId, display_name: displayName };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const baseUrl = getBaseUrl(request);

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/epic?error=Missing+code`);
  }

  const redirectUri = `${baseUrl}/auth/epic/callback`;
  const epicUser = await exchangeCodeForEpicToken(code, redirectUri);
  if (!epicUser) {
    return NextResponse.redirect(`${baseUrl}/auth/epic?error=Epic+auth+failed`);
  }

  const { account_id: accountId, display_name: displayName } = epicUser;
  const supabase = createServerClient();
  const email = `epic_${accountId}@users.grandstudio.epic`;

  let userId: string;

  try {
    const { data: existing } = await supabase
      .from("epic_accounts")
      .select("user_id")
      .eq("epic_account_id", accountId)
      .single();

    if (existing?.user_id) {
      userId = existing.user_id;
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          epic_account_id: accountId,
          full_name: displayName || undefined,
        },
      });

      if (createError) {
        if (createError.message.includes("already been registered")) {
          const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const byEmail = list?.users?.find((u) => u.email === email);
          if (byEmail) {
            userId = byEmail.id;
            await supabase.from("epic_accounts").upsert(
              { epic_account_id: accountId, user_id: userId },
              { onConflict: "epic_account_id" }
            );
          } else {
            return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+sign+in`);
          }
        } else {
          return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+create+account`);
        }
      } else if (newUser?.user) {
        userId = newUser.user.id;
        await supabase.from("epic_accounts").insert({
          epic_account_id: accountId,
          user_id: userId,
        });
      } else {
        return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+create+account`);
      }
    }
  } catch (e) {
    const hasTable = await supabase.from("epic_accounts").select("epic_account_id").limit(1);
    if (hasTable.error && hasTable.error.code === "42P01") {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { epic_account_id: accountId, full_name: displayName || undefined },
      });
      if (createError || !newUser?.user) {
        return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+sign+in`);
      }
      userId = newUser.user.id;
    } else {
      return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+sign+in`);
    }
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.redirect(`${baseUrl}/auth/epic?error=Could+not+sign+in`);
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
