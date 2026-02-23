import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** GET: list published courses. Optional ?courseId= for single course with lessons. */
export async function GET(req: Request) {
  try {
    const courseId = new URL(req.url).searchParams.get("courseId");
    const supabase = createServerClient();
    if (courseId) {
      const [courseRes, lessonsRes] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).eq("is_published", true).single(),
        supabase.from("course_lessons").select("*").eq("course_id", courseId).order("lesson_number", { ascending: true }),
      ]);
      if (courseRes.error || !courseRes.data) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
      return NextResponse.json({
        course: courseRes.data,
        lessons: lessonsRes.data ?? [],
      });
    }
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ courses: data ?? [] });
  } catch (e) {
    console.error("[education/courses] GET:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
