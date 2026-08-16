import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { CommandPalette } from "@/components/dashboard/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--gs-bg-base)] relative">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <DashboardTopBar />
        <main className="flex-1">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
