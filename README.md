This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Stripe billing

Pricing tiers (Starter free, Pro $29/mo, Studio $99/mo, Enterprise $299/mo) use Stripe Checkout.

1. In [Stripe Dashboard](https://dashboard.stripe.com/products) create three Products with recurring Prices (monthly): Pro $29, Studio $99, Enterprise $299.
2. Copy each Price ID (e.g. `price_xxx`) and set in `.env.local`:
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_STUDIO`, `STRIPE_PRICE_ID_ENTERPRISE`
3. For production webhooks: Stripe Dashboard → Developers → Webhooks → Add endpoint → `https://your-domain.com/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Set `STRIPE_WEBHOOK_SECRET` in Vercel.
4. Run `supabase-migration-subscriptions.sql` in Supabase so subscription records are stored.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
