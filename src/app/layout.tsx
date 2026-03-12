import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grand Studio — UE5 AI Co-Pilot",
  description:
    "Build Unreal Engine 5 scenes 10x faster with AI. Describe your scene, AI generates code, UE5 executes it live.",
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
