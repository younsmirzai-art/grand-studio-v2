"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Crown, Loader2, Send, Check, ChevronRight, ChevronLeft, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/collaboration/user";
import LiveViewport from "@/components/tools/LiveViewport";
import { toast } from "sonner";

type Course = { id: string; title: string };
type Lesson = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  agent_prompt: string | null;
  expected_result: string | null;
  duration_minutes: number;
};

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:python)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const code = m[1].trim();
    if (code && code.includes("import unreal")) blocks.push(code);
  }
  return blocks;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string | undefined;
  const lessonId = params?.lessonId as string | undefined;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<{ lesson_id: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const { userEmail } = typeof window !== "undefined" ? getCurrentUser() : { userEmail: "" };

  useEffect(() => {
    if (!courseId || !lessonId) return;
    let cancelled = false;
    (async () => {
      const courseRes = await fetch(`/api/education/courses?courseId=${courseId}`);
      const courseData = await courseRes.json();
      if (!courseRes.ok || !courseData.course) {
        if (!cancelled) setLoading(false);
        return;
      }
      const lessonsList = Array.isArray(courseData.lessons) ? courseData.lessons : [];
      const current = lessonsList.find((l: Lesson) => l.id === lessonId);
      if (!cancelled) {
        setCourse(courseData.course);
        setLesson(current ?? null);
        setLessons(lessonsList);
        if (current?.agent_prompt) setMessage(current.agent_prompt);
      }

      if (userEmail) {
        const progressRes = await fetch(
          `/api/education/progress?userEmail=${encodeURIComponent(userEmail)}&courseId=${courseId}`
        );
        const progressData = progressRes.ok ? await progressRes.json() : { progress: [] };
        if (!cancelled) setProgress(Array.isArray(progressData.progress) ? progressData.progress : []);
      }

      if (userEmail) {
        const projRes = await fetch(`/api/education/learning-project?userEmail=${encodeURIComponent(userEmail)}`);
        const projData = await projRes.json();
        if (projRes.ok && projData.projectId && !cancelled) setProjectId(projData.projectId);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [courseId, lessonId, userEmail]);

  const completedIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const isCompleted = lessonId ? completedIds.has(lessonId) : false;
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;
  const allCompleted = lessons.length > 0 && lessons.every((l) => completedIds.has(l.id));

  const sendToThomas = useCallback(async () => {
    if (!projectId || !message.trim() || sending) return;
    setSending(true);
    setLastResponse(null);
    try {
      const res = await fetch("/api/agents/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, agentName: "Thomas", message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send");
        return;
      }
      setLastResponse(data.response ?? "");
      toast.success("Thomas replied");
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }, [projectId, message, sending]);

  const runInUE5 = useCallback(async () => {
    const text = lastResponse ?? message;
    const blocks = extractCodeBlocks(text);
    if (blocks.length === 0) {
      toast.error("No executable code in the response. Ask Thomas to generate UE5 Python code.");
      return;
    }
    if (!projectId) {
      toast.error("No learning project");
      return;
    }
    setExecuting(true);
    try {
      for (const code of blocks) {
        const res = await fetch("/api/ue5/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            code,
            agentName: "Thomas",
            ...(userEmail && { submittedByEmail: userEmail }),
            submittedByName: "Academy",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Execute failed");
          break;
        }
      }
      if (blocks.length > 0) toast.success("Sent to UE5. Check the viewport.");
    } catch {
      toast.error("Failed to send to UE5");
    } finally {
      setExecuting(false);
    }
  }, [lastResponse, message, projectId, userEmail]);

  const markComplete = useCallback(async () => {
    if (!userEmail || !courseId || !lessonId) return;
    const res = await fetch("/api/education/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail,
        courseId,
        lessonId,
        status: "completed",
      }),
    });
    if (res.ok) {
      setProgress((prev) => [...prev.filter((p) => p.lesson_id !== lessonId), { lesson_id: lessonId, status: "completed" }]);
      toast.success("Lesson marked complete!");
    } else {
      toast.error("Failed to save progress");
    }
  }, [userEmail, courseId, lessonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-boss-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!course || !lesson) {
    return (
      <div className="min-h-screen bg-boss-bg flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Lesson not found.</p>
        <Link href="/learn">
          <Button variant="outline">Back to Academy</Button>
        </Link>
      </div>
    );
  }

  if (allCompleted && isCompleted) {
    return (
      <div className="min-h-screen bg-boss-bg">
        <nav className="border-b border-boss-border bg-boss-surface/80">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
            <Link href="/" className="flex items-center gap-2 text-text-primary">
              <Crown className="w-4 h-4 text-gold" />
              <span className="font-bold">Grand Studio</span>
            </Link>
          </div>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Course Complete!</h1>
          <p className="text-text-muted mb-8">You finished &quot;{course.title}&quot;. Great work!</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/learn">
              <Button className="bg-gold hover:bg-gold/90 text-boss-bg gap-2">
                Browse more courses
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href={`/learn/${courseId}`}>
              <Button variant="outline">Review course</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const hasCodeInResponse = lastResponse && extractCodeBlocks(lastResponse).length > 0;

  return (
    <div className="min-h-screen bg-boss-bg flex flex-col">
      <nav className="border-b border-boss-border bg-boss-surface/80 shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary hover:text-gold transition-colors">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold">Grand Studio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/learn/${courseId}`} className="text-sm text-text-muted hover:text-text-primary">
              ← {course.title}
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="lg:w-1/2 xl:w-3/5 flex flex-col min-h-[320px] border-b lg:border-b-0 lg:border-r border-boss-border">
          <LiveViewport projectId={projectId ?? ""} refreshInterval={5} />
        </div>

        <div className="lg:w-1/2 xl:w-2/5 flex flex-col overflow-auto bg-boss-surface/50">
          <div className="p-6 space-y-6">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Lesson {lesson.lesson_number}</p>
              <h1 className="text-xl font-bold text-text-primary mt-1">{lesson.title}</h1>
            </div>
            {lesson.description && (
              <p className="text-text-secondary text-sm">{lesson.description}</p>
            )}
            {lesson.expected_result && (
              <div className="rounded-lg border border-boss-border bg-boss-card/60 p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Expected result</p>
                <p className="text-sm text-text-primary">{lesson.expected_result}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-text-muted block mb-2">Ask Thomas (suggested prompt)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. @thomas create a ground plane..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-boss-card border border-boss-border text-text-primary placeholder:text-text-muted text-sm resize-none focus:outline-none focus:border-gold/50"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="sm"
                  className="bg-agent-green hover:bg-agent-green/90 gap-2"
                  onClick={sendToThomas}
                  disabled={sending || !projectId}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Thomas
                </Button>
                {hasCodeInResponse && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-boss-border"
                    onClick={runInUE5}
                    disabled={executing || !projectId}
                  >
                    {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Run in UE5
                  </Button>
                )}
              </div>
            </div>

            {lastResponse && (
              <div className="rounded-lg border border-boss-border bg-boss-card/80 p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Thomas&apos;s response</p>
                <div className="text-sm text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {lastResponse}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-boss-border">
              {!isCompleted && (
                <Button
                  className="bg-gold hover:bg-gold/90 text-boss-bg gap-2"
                  onClick={markComplete}
                >
                  <Check className="w-4 h-4" />
                  Mark Complete
                </Button>
              )}
              {isCompleted && (
                <span className="text-agent-green text-sm font-medium flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Completed
                </span>
              )}
              {nextLesson ? (
                <Link href={`/learn/${courseId}/${nextLesson.id}`}>
                  <Button variant="outline" className="gap-2 border-boss-border">
                    Next lesson
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link href={`/learn/${courseId}`}>
                  <Button variant="outline" className="gap-2 border-boss-border">
                    Back to course
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <Link href={`/learn/${courseId}/${lessonId}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-text-muted">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset lesson
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
