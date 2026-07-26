export const STRIPE_PRICES = {
  // Pro tier — $4.99/month unlimited. Real price ID created in Stripe Dashboard (Phase 6).
  PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_TBD",
} as const;

// --- Deprecated pricing (old 3-tier SaaS model) — kept for reference only ---
// pro:  "price_1TB7ijFNUGc8wt3GAHPe6LBA"  // old $19/mo
// team: "price_1TB7k1FNUGc8wt3GjUdT9A4V"  // old $49/mo — Team tier removed
