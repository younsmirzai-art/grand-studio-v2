import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const userEmail = u.searchParams.get("userEmail");
    const courseId = u.searchParams.get("courseId");
    const all = u.searchParams.get("all") === "true";
    if (!userEmail?.trim()) return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    const supabase = createServerClient();
    if (all) {
      const { data, error } = await supabase.from("student_progress").select("*").eq("user_email", userEmail.trim());
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ progress: data ?? [] });
    }
    if (!courseId) return NextResponse.json({ error: "courseId required or all=true" }, { status: 400 });
    const { data, error } = await supabase.from("student_progress").select("*").eq("user_email", userEmail.trim()).eq("course_id", courseId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ progress: data ?? [] });
  } catch (e) {
    console.error("[education/progress] GET:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userEmail = body.userEmail as string | undefined;
    const courseId = body.courseId as string | undefined;
    const lessonId = body.lessonId as string | undefined;
    const status = body.status as string | undefined;
    const score = body.score as number | undefined;
    if (!userEmail?.trim() || !courseId || !lessonId) {
      return NextResponse.json({ error: "userEmail, courseId, lessonId required" }, { status: 400 });
    }
    const supabase = createServerClient();
    const { error } = await supabase.from("student_progress").upsert(
      {
        user_email: userEmail.trim(),
        course_id: courseId,
        lesson_id: lessonId,
        status: status === "completed" ? "completed" : "in_progress",
        score: score ?? 0,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      },
      { onConflict: "user_email,lesson_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[education/progress] POST:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
