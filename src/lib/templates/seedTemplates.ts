import { createServerClient } from "@/lib/supabase/server";
import { officialTemplates } from "./officialTemplates";
import type { OfficialTemplateInput } from "./officialTemplates";

export async function seedOfficialTemplates(): Promise<{ inserted: number; skipped: number }> {
  const supabase = createServerClient();
  let inserted = 0;
  let skipped = 0;

  for (const t of officialTemplates as OfficialTemplateInput[]) {
    const { data: existing } = await supabase
      .from("game_templates")
      .select("id")
      .eq("name", t.name)
      .eq("is_official", true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("game_templates").insert({
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      author_name: "Grand Studio",
      price: 0,
      is_free: t.is_free,
      is_featured: t.is_featured ?? false,
      is_official: t.is_official,
      download_count: 0,
      rating: 0,
      rating_count: 0,
      template_data: t.template_data,
      ue5_code: t.ue5_code.trim(),
      game_dna_preset: t.game_dna_preset,
      agents_used: t.agents_used,
      estimated_build_time: t.estimated_build_time,
      difficulty: t.difficulty,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[seedTemplates] Insert error for", t.name, error);
      continue;
    }
    inserted++;
  }

  return { inserted, skipped };
}
