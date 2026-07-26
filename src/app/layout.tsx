import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConditionalChrome } from "@/components/site/ConditionalChrome";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Grand Studio — The Universal 3D Model Hub",
    template: "%s | Grand Studio",
  },
  description:
    "Download 3D models from every marketplace in one place. 500K+ models, AI-powered search, free tier available.",
  keywords: [
    "3D models",
    "3D marketplace",
    "Poly Haven",
    "Sketchfab",
    "Unreal Engine",
    "Blender",
    "Free 3D models",
  ],
  authors: [{ name: "Grand Studio", url: "https://grandstudio.dev" }],
  metadataBase: new URL("https://grandstudio.dev"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://grandstudio.dev",
    siteName: "Grand Studio",
    title: "Grand Studio — The Universal 3D Model Hub",
    description: "Download 3D models from every marketplace in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grand Studio — The Universal 3D Model Hub",
    description: "Download 3D models from every marketplace in one place.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark scroll-smooth ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans antialiased bg-[var(--gs-bg-base)] text-white">
        <TooltipProvider delayDuration={200}>
          <ConditionalChrome>{children}</ConditionalChrome>
        </TooltipProvider>
        <Analytics />
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
