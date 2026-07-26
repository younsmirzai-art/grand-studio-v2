"use client";

import { motion } from "framer-motion";

interface DashboardWelcomeProps {
  userName: string;
}

export function DashboardWelcome({ userName }: DashboardWelcomeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight mb-1">
        Welcome back{userName ? `, ${userName}` : ""}
      </h1>
      <p className="text-sm text-white/50">
        Here&apos;s what&apos;s happening with your account today.
      </p>
    </motion.div>
  );
}
