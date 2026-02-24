import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grand Studio v2 — AI Game Development Command Center",
  description:
    "Multi-agent AI platform for Unreal Engine 5 game development. Command your team of AI agents to build games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark font-sans-vars">
      <body className="font-sans antialiased">
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#10131a",
              border: "1px solid #1e2330",
              color: "#eef0f4",
            },
          }}
        />
      </body>
    </html>
  );
}
