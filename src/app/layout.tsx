import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grand Studio — The AI Co-Pilot for Unreal Engine",
  description:
    "Build professional UE5 scenes 10x faster. Describe what you want, AI writes the code, Unreal Engine builds it live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark scroll-smooth ${inter.variable}`}>
      <body className="font-sans antialiased bg-[#0A0A0B] text-white">
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#111114",
              border: "1px solid #2A2A30",
              color: "#FFFFFF",
            },
          }}
        />
      </body>
    </html>
  );
}
