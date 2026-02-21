import { NextResponse } from "next/server";
import { seedOfficialTemplates } from "@/lib/templates/seedTemplates";

export async function POST() {
  try {
    const { inserted, skipped } = await seedOfficialTemplates();
    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      message: `Seeded ${inserted} templates, ${skipped} already existed.`,
    });
  } catch (error) {
    console.error("[templates/seed]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
