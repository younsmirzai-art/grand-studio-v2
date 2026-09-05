import type { Metadata } from "next";
import { LaocoonLanding } from "@/components/site/LaocoonLanding";

export const metadata: Metadata = {
  title: "The Statue of Laocoön",
  description:
    "Bronze and Time — a cinematic WebGL study of a glowing bronze sculpture across forge sparks and liquid metal light.",
};

export default function HomePage() {
  return <LaocoonLanding />;
}
