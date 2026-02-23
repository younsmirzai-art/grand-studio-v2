"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Crown, BookOpen, Clock, Star, ChevronRight, Loader2, GraduationCap, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/collaboration/user";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  is_free: boolean;
  duration_minutes: number;
  rating?: number;
};

type Progress = { course_id: string; lesson_id: string; status: string; completed_at: string | null }[];

const CATEGORY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress>([]);
  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);

  const userEmail = typeof window !== "undefined" ? getCurrentUser().userEmail : "";

  const fetchCourses = useCallback(async () => {
    const res = await fetch("/api/education/courses");
    const data = await res.json();
    if (res.ok && Array.isArray(data.courses)) setCourses(data.courses);
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!userEmail) return;
    const res = await fetch(`/api/education/progress?userEmail=${encodeURIComponent(userEmail)}&all=true`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.progress)) setProgress(data.progress);
  }, [userEmail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSeedLoading(true);
      try {
        await fetch("/api/education/seed", { method: "POST" });
        if (!cancelled) await fetchCourses();
        if (!cancelled && userEmail) await fetchProgress();
      } catch {
        if (!cancelled) await fetchCourses();
      } finally {
        if (!cancelled) setSeedLoading(false);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchCourses, fetchProgress, userEmail]);

  const completedByCourse = progress.filter((p) => p.status === "completed");
  const completedLessonIds = new Set(completedByCourse.map((p) => p.lesson_id));
  const courseIds = new Set(courses.map((c) => c.id));
  const completedCount = courseIds.size
    ? Array.from(courseIds).filter((cid) => {
        const lessonIdsForCourse = progress.filter((p) => p.course_id === cid).map((p) => p.lesson_id);
        const course = courses.find((c) => c.id === cid);
        if (!course) return false;
        const totalLessons = 6;
        const completed = lessonIdsForCourse.filter((lid) =>
          completedByCourse.some((p) => p.lesson_id === lid && p.course_id === cid)
        ).length;
        return completed >= totalLessons;
      }).length
    : 0;
  const totalCourses = courses.length;
  const progressPct = totalCourses ? Math.round((completedCount / totalCourses) * 100) : 0;

  const byCategory = courses.reduce<Record<string, Course[]>>((acc, c) => {
    const cat = c.difficulty || c.category || "beginner";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="border-b border-boss-border bg-boss-surface/80 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary hover:text-gold transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-gold" />
            </div>
            <span className="font-bold">Grand Studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-text-muted hover:text-text-primary">
              Dashboard
            </Link>
            <Link href="/learn" className="text-sm font-medium text-gold">
              Academy
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tight flex items-center justify-center gap-3">
            <GraduationCap className="w-10 h-10 text-gold" />
            Grand Studio Academy
          </h1>
          <p className="text-text-muted mt-2 max-w-xl mx-auto">
            Interactive AI courses. Learn UE5 step by step with Thomas and your AI team.
          </p>
        </div>

        {userEmail && (
          <div className="rounded-2xl border border-boss-border bg-boss-card/80 p-6 mb-10">
            <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gold" />
              Your Progress
            </h2>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {completedCount} <span className="text-text-muted font-normal">/ {totalCourses} courses</span>
                </p>
                <p className="text-xs text-text-muted">Completed</p>
              </div>
              <div className="flex-1 min-w-[120px] max-w-xs">
                <div className="h-2 rounded-full bg-boss-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gold/80 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">{progressPct}%</p>
              </div>
              <div className="flex items-center gap-2 text-agent-amber">
                <Flame className="w-5 h-5" />
                <span className="font-medium">Keep learning!</span>
              </div>
            </div>
          </div>
        )}

        {loading || seedLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : (
          <>
            <section className="mb-12">
              <h2 className="text-xl font-bold text-text-primary mb-4">Recommended</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.slice(0, 3).map((course) => (
                  <CourseCard key={course.id} course={course} completedLessonIds={completedLessonIds} progress={progress} />
                ))}
              </div>
            </section>

            {["beginner", "intermediate", "advanced"].map((cat) => {
              const list = byCategory[cat];
              if (!list?.length) return null;
              return (
                <section key={cat} className="mb-12">
                  <h2 className="text-xl font-bold text-text-primary mb-4">{CATEGORY_LABELS[cat] ?? cat}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {list.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        completedLessonIds={completedLessonIds}
                        progress={progress}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {!loading && courses.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <p>No courses yet. Seed the database from the API or try again later.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function CourseCard({
  course,
  completedLessonIds,
  progress,
}: {
  course: Course;
  completedLessonIds: Set<string>;
  progress: Progress;
}) {
  const [lessonCount, setLessonCount] = useState<number | null>(null);
  useEffect(() => {
    fetch(`/api/education/courses?courseId=${course.id}`)
      .then((r) => r.json())
      .then((d) => setLessonCount(Array.isArray(d.lessons) ? d.lessons.length : 0))
      .catch(() => setLessonCount(0));
  }, [course.id]);
  const completedInCourse = progress.filter((p) => p.course_id === course.id && p.status === "completed").length;
  const total = lessonCount ?? 6;

  return (
    <Link
      href={`/learn/${course.id}`}
      className="block rounded-2xl border border-boss-border bg-boss-card/60 p-6 hover:border-gold/40 hover:bg-boss-elevated/50 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-text-primary">{course.title}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold/20 text-gold">
          {course.is_free ? "FREE" : "Pro"}
        </span>
      </div>
      <p className="text-sm text-text-muted line-clamp-2 mb-4">{course.description}</p>
      <div className="flex items-center gap-3 text-text-muted text-xs mb-4">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {course.duration_minutes} min
        </span>
        {course.rating != null && (
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            {Number(course.rating).toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {completedInCourse}/{total} lessons
        </span>
        <span className="text-gold text-sm font-medium flex items-center gap-1">
          {completedInCourse >= total ? "Review" : "Start"}
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
