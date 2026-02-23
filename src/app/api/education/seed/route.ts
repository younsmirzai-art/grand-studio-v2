import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { officialCourses } from "@/lib/education/officialCourses";

export async function POST() {
  try {
    const supabase = createServerClient();
    const { count } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      return NextResponse.json({ message: "Courses already seeded", skipped: true });
    }
    for (const course of officialCourses) {
      const { data: courseRow, error: courseErr } = await supabase
        .from("courses")
        .insert({
          title: course.title,
          description: course.description,
          category: course.category,
          difficulty: course.difficulty,
          is_free: course.is_free,
          duration_minutes: course.duration_minutes,
          is_published: true,
        })
        .select("id")
        .single();
      if (courseErr || !courseRow) continue;
      const cid = (courseRow as { id: string }).id;
      for (const lesson of course.lessons) {
        await supabase.from("course_lessons").insert({
          course_id: cid,
          lesson_number: lesson.lesson_number,
          title: lesson.title,
          description: lesson.description,
          agent_prompt: lesson.agent_prompt,
          expected_result: lesson.expected_result,
          duration_minutes: lesson.duration_minutes,
        });
      }
    }
    return NextResponse.json({ message: "Courses seeded successfully" });
  } catch (e) {
    console.error("[education/seed] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
