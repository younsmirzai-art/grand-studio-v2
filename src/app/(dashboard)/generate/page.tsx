import { GenerateStudio } from "@/components/dashboard/GenerateStudio";

export const metadata = {
  title: "AI Generator",
  description: "Create 3D models from text prompts.",
};

export default function GeneratePage() {
  return <GenerateStudio />;
}
