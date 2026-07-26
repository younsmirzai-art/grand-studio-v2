"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Rocket, ArrowRight, Sparkles } from "lucide-react";

export function PluginBanner() {
  return (
    <section className="gs-section">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative gs-card-elevated p-8 md:p-16 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10" />
          <div
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-40 blur-3xl"
            style={{
              background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-40 blur-3xl"
            style={{
              background: "radial-gradient(circle, #00D4FF 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
                <Rocket className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  Coming Soon to Fab Marketplace
                </span>
              </div>

              <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-6 leading-tight">
                Building UE5 games?
                <br />
                <span className="gs-text-gradient">Get AI Commander.</span>
              </h2>

              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Our Unreal Engine 5.7 plugin brings AI-powered world building
                right into the editor. Describe your scene, watch it built live.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/plugin"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/plugin#features"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl gs-glass text-white font-medium hover:bg-white/10 transition-all"
                >
                  See Features
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-video rounded-xl gs-glass overflow-hidden gs-glow-purple-lg border border-white/10">
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-cyan-500/20 relative">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full gs-glass mb-4 gs-animate-pulse-glow">
                      <Sparkles className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className="text-white/60 text-sm font-medium">
                      Demo Video Coming Soon
                    </p>
                    <p className="text-white/40 text-xs mt-1">
                      UE5.7 · AI City Builder
                    </p>
                  </div>
                </div>
              </div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 gs-glass rounded-lg px-3 py-2 text-xs font-medium text-white/90 border border-white/20"
              >
                AI City Builder
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-4 -left-4 gs-glass rounded-lg px-3 py-2 text-xs font-medium text-white/90 border border-white/20"
              >
                One-click Screenshots
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
