"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface WelcomePanelProps {
  userName?: string;
  status?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Late night hustle";
}

export function WelcomePanel({
  userName = "Explorer",
  status = "500K+ models available",
}: WelcomePanelProps) {
  const greeting = getGreeting();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="text-center pt-32 pb-12 px-6"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full gs-glass mb-6">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-white/70">{status}</span>
      </div>

      <h1 className="text-4xl md:text-6xl font-display font-bold mb-3">
        <span className="gs-shimmer-text">
          {greeting}, {userName}
        </span>
      </h1>

      <p className="text-lg text-white/60 max-w-xl mx-auto">
        Ready to explore the universe of 3D creation?
      </p>
    </motion.div>
  );
}
