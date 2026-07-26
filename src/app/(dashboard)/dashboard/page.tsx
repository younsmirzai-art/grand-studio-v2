import { Suspense } from "react";
import { createServerAuthClient } from "@/lib/supabase/server";
import { StatsSection } from "@/components/dashboard/StatsSection";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecommendedModels } from "@/components/dashboard/RecommendedModels";
import { TrendingModels } from "@/components/dashboard/TrendingModels";
import { QuickStartCard } from "@/components/dashboard/QuickStartCard";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";

export const metadata = {
  title: "Dashboard",
  description: "Your Grand Studio workspace overview.",
};

function ModelsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="gs-card aspect-square animate-pulse bg-white/5" />
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <DashboardWelcome userName={userName} />

      <section className="mb-8">
        <StatsSection />
      </section>

      <OnboardingChecklist />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div>
          <QuickStartCard />
        </div>
      </div>

      <section className="mb-8">
        <Suspense fallback={<ModelsSkeleton />}>
          <RecommendedModels />
        </Suspense>
      </section>

      <section className="mb-8">
        <Suspense fallback={<ModelsSkeleton />}>
          <TrendingModels />
        </Suspense>
      </section>
    </div>
  );
}
