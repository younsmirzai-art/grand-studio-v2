"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Crown, Clock, ChevronRight, Check, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/collaboration/user";

type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  is_free: boolean;
  duration_minutes: number;
};

type Lesson = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  duration_minutes: number;
};

type Progress = { lesson_id: string; status: string }[];

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string | undefined;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress>([]);
  const [loading, setLoading] = useState(true);

  const userEmail = typeof window !== "undefined" ? getCurrentUser().userEmail : "";

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      const [courseRes, progressRes] = await Promise.all([
        fetch(`/api/education/courses?courseId=${courseId}`),
        userEmail
          ? fetch(`/api/education/progress?userEmail=${encodeURIComponent(userEmail)}&courseId=${courseId}`)
          : Promise.resolve({ ok: false, json: () => ({ progress: [] }) }),
      ]);
      const courseData = await courseRes.json();
      const progressData = progressRes.ok ? await progressRes.json() : { progress: [] };
      if (!cancelled && courseData.course) {
        setCourse(courseData.course);
        setLessons(Array.isArray(courseData.lessons) ? courseData.lessons : []);
        setProgress(Array.isArray(progressData.progress) ? progressData.progress : []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [courseId, userEmail]);

  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const nextLesson = lessons.find((l) => !completedIds.has(l.id));
  const completedCount = completedIds.size;
  const totalLessons = lessons.length;
  const progressPct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-boss-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-boss-bg flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Course not found.</p>
        <Link href="/learn">
          <Button variant="outline">Back to Academy</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="border-b border-boss-border bg-boss-surface/80 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary hover:text-gold transition-colors">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold">Grand Studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-sm text-text-muted hover:text-text-primary">
              Academy
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/learn" className="text-sm text-text-muted hover:text-text-primary mb-6 inline-block">
          ← Back to Academy
        </Link>

        <div className="rounded-2xl border border-boss-border bg-boss-card/80 p-8 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">{course.title}</h1>
          <p className="text-text-muted mb-4">{course.description}</p>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {course.duration_minutes} min
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gold/20 text-gold text-xs font-medium">
              {course.is_free ? "FREE" : "Pro"}
            </span>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-boss-elevated overflow-hidden max-w-xs">
              <div
                className="h-full rounded-full bg-gold/80 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              {completedCount} / {totalLessons} lessons completed
            </p>
          </div>
          {nextLesson && (
            <Button
              className="mt-6 bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
              onClick={() => router.push(`/learn/${courseId}/${nextLesson.id}`)}
            >
              {completedCount === 0 ? "Start course" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {!nextLesson && totalLessons > 0 && (
            <div className="mt-6 flex items-center gap-2 text-agent-green">
              <Check className="w-5 h-5" />
              <span className="font-medium">Course complete!</span>
              <Link href="/learn">
                <Button variant="outline" size="sm">Pick another course</Button>
              </Link>
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gold" />
          Lessons
        </h2>
        <ul className="space-y-2">
          {lessons.map((lesson) => {
            const done = completedIds.has(lesson.id);
            return (
              <li key={lesson.id}>
                <Link
                  href={`/learn/${courseId}/${lesson.id}`}
                  className="flex items-center gap-4 rounded-xl border border-boss-border bg-boss-card/60 p-4 hover:border-gold/40 hover:bg-boss-elevated/50 transition-all"
                >
                  <div className="w-8 h-8 rounded-full border border-boss-border flex items-center justify-center shrink-0">
                    {done ? (
                      <Check className="w-4 h-4 text-agent-green" />
                    ) : (
                      <span className="text-sm font-medium text-text-muted">{lesson.lesson_number}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{lesson.title}</p>
                    <p className="text-xs text-text-muted">{lesson.duration_minutes} min</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>

        {lessons.length === 0 && (
          <p className="text-text-muted text-center py-8">No lessons in this course yet.</p>
        )}
      </main>
    </div>
  );
}
