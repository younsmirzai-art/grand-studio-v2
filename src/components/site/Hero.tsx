"use client";

import { motion } from "framer-motion";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const HeroScene = dynamic(
  () => import("./HeroScene").then((mod) => ({ default: mod.HeroScene })),
  { ssr: false, loading: () => null }
);

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--gs-gradient-hero)" }}
      />

      <HeroScene />

      <div className="absolute inset-0 gs-grid-pattern opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full gs-glass mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-white/80">
            500K+ models from 20+ sources
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-6 leading-[1.05]"
        >
          The Universal
          <br />
          <span className="gs-text-gradient-hero">3D Model Hub</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Download 3D models from Poly Haven, Sketchfab, and more —{" "}
          <span className="text-white/90 font-medium">all in one place</span>.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          action="/browse"
          method="GET"
          className="max-w-2xl mx-auto mb-8"
        >
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 blur-xl opacity-25 group-focus-within:opacity-50 transition-opacity duration-300" />
            <div className="relative flex items-center gap-3 gs-glass-strong rounded-2xl px-6 py-4 border border-white/10 group-focus-within:border-white/20 transition-colors">
              <Search className="w-5 h-5 text-white/50 flex-shrink-0" />
              <input
                type="text"
                name="q"
                placeholder="Search 500K+ 3D models..."
                className="flex-1 bg-transparent text-white placeholder:text-white/40 outline-none text-base md:text-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/browse"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all"
          >
            Start Browsing Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gs-glass text-white font-medium hover:bg-white/10 transition-all"
          >
            Get Pro — $4.99/mo
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> Free tier available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> 10 downloads/day free
          </span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-2 rounded-full bg-white/40"
          />
        </div>
      </motion.div>
    </section>
  );
}
