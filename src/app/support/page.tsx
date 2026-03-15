"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { MessageSquare, Send } from "lucide-react";

const SUBJECT_OPTIONS = [
  "General Question",
  "Technical Issue",
  "Billing",
  "Cancel Subscription",
  "Other",
] as const;

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<typeof SUBJECT_OPTIONS[number]>("General Question");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = createAuthClient();
    auth.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setEmail(data.user.email);
        const displayName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? "";
        if (displayName && !name) setName(displayName);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
      setName("");
      setMessage("");
      setSubject("General Question");
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <header className="border-b border-white/5 bg-[#111114] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.2em] uppercase text-white hover:text-[#2196F3] transition">
            Grand Studio
          </Link>
          <Link href="/dashboard" className="text-sm text-[#A0A0A8] hover:text-white transition">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-xl bg-[#2196F3]/10 border border-[#2196F3]/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-[#2196F3]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contact Support</h1>
            <p className="text-sm text-[#A0A0A8]">We&apos;ll get back to you within 24 hours.</p>
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl border border-[#2196F3]/20 bg-[#2196F3]/5 p-8 text-center">
            <p className="text-lg font-semibold text-white mb-2">Thanks! We&apos;ll get back to you within 24 hours.</p>
            <p className="text-sm text-[#A0A0A8] mb-6">Check your email for confirmation.</p>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="text-sm text-[#2196F3] hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-[#A0A0A8] uppercase tracking-wider mb-2">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#111114] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#A0A0A8] uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-[#111114] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-xs font-medium text-[#A0A0A8] uppercase tracking-wider mb-2">
                Subject
              </label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value as typeof subject)}
                className="w-full px-4 py-3 rounded-xl bg-[#111114] border border-white/10 text-white outline-none focus:border-[#2196F3]/40 transition"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="block text-xs font-medium text-[#A0A0A8] uppercase tracking-wider mb-2">
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-[#111114] border border-white/10 text-white placeholder:text-[#606068] outline-none focus:border-[#2196F3]/40 transition resize-y"
                placeholder="How can we help?"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] text-white font-semibold hover:brightness-110 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="mt-10 text-sm text-[#606068] text-center">
          We typically respond within 24 hours. Check your email for a confirmation after submitting.
        </p>
      </main>
    </div>
  );
}
