"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const categories = [
  {
    name: "Nature",
    slug: "nature",
    emoji: "🌲",
    gradient: "from-green-500/20 to-emerald-500/10",
  },
  {
    name: "Architecture",
    slug: "architecture",
    emoji: "🏛️",
    gradient: "from-amber-500/20 to-orange-500/10",
  },
  {
    name: "Vehicles",
    slug: "vehicles",
    emoji: "🚗",
    gradient: "from-red-500/20 to-rose-500/10",
  },
  {
    name: "Characters",
    slug: "characters",
    emoji: "👤",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  {
    name: "Sci-Fi",
    slug: "scifi",
    emoji: "🚀",
    gradient: "from-purple-500/20 to-violet-500/10",
  },
  {
    name: "Fantasy",
    slug: "fantasy",
    emoji: "🐉",
    gradient: "from-pink-500/20 to-rose-500/10",
  },
  {
    name: "Weapons",
    slug: "weapons",
    emoji: "⚔️",
    gradient: "from-slate-500/20 to-gray-500/10",
  },
  {
    name: "Furniture",
    slug: "furniture",
    emoji: "🪑",
    gradient: "from-yellow-500/20 to-amber-500/10",
  },
];

export function Categories() {
  return (
    <section className="gs-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="gs-section-label">Explore</span>
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-4">
            Every category, covered
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            From nature to sci-fi, find the perfect model for your next project.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat, index) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <Link
                href={`/browse?category=${cat.slug}`}
                className="block gs-card p-6 group hover:scale-[1.02] transition-transform"
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-2xl mb-4 border border-white/5`}
                >
                  {cat.emoji}
                </div>
                <h3 className="font-display font-semibold text-lg mb-1 text-white">
                  {cat.name}
                </h3>
                <p className="text-xs text-white/40 group-hover:text-cyan-400 transition-colors">
                  Explore →
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
