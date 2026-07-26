import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--gs-bg-base)]">
      <Sidebar />
      <div className="lg:pl-64">
        <DashboardTopBar />
        <main className="min-h-[calc(100vh-56px)]">{children}</main>
      </div>
    </div>
  );
}
