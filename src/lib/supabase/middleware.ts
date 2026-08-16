import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = [
  "/",
  "/browse",
  "/model",
  "/plugin",
  "/pricing",
  "/support",
  "/privacy",
  "/terms",
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/auth/epic",
  "/auth/magic-link",
];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Edge middleware cannot read Vercel "Sensitive" env vars. Never throw here —
  // a crash in middleware returns 500 with no route execution and no outbound calls.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[middleware] missing supabase env", {
      pathname,
      hasUrl: Boolean(supabaseUrl),
      hasAnon: Boolean(supabaseAnonKey),
      urlLength: supabaseUrl?.length ?? 0,
      anonLength: supabaseAnonKey?.length ?? 0,
    });
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isPublic =
      pathname === "/" ||
      pathname.startsWith("/api/") ||
      publicPaths.some(
        (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
      );

    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    console.error(
      "[middleware] session error",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.next({ request });
  }
}
