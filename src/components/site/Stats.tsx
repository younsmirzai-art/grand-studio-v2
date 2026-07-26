"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "500K+", label: "Models Available" },
  { value: "20+", label: "Trusted Sources" },
  { value: "4K+", label: "Free Downloads Daily" },
  { value: "99.9%", label: "Uptime" },
];

export function Stats() {
  return (
    <section className="py-16 md:py-24 border-y border-white/5 bg-black/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-6xl font-display font-bold gs-text-gradient mb-2">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-white/50 uppercase tracking-wider font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
