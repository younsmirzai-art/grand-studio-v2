"use client";

import { NotificationsMenu } from "@/components/dashboard/NotificationsMenu";

export function DashboardTopBar() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-white/10 bg-[#090D16]/75 backdrop-blur-xl">
      <div className="h-full px-4 lg:px-6 flex items-center justify-end">
        <NotificationsMenu />
      </div>
    </header>
  );
}
