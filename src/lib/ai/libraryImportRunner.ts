/**
 * Legacy agent path: library models are no longer pushed into UE5 via relay.
 * Scanned-asset–only builds still work when the agent has paths from the project.
 */

import type { ImportProgressEvent } from "@/lib/ai/agentImportTypes";

export const MAX_IMPORTS_PER_STEP = 5;
export const MAX_IMPORTS_PER_SCENE = 25;

export type RunLibraryImportArgs = {
  action: string;
  userPrompt: string;
  projectId: string;
  userId: string;
  stepNumber: number;
  count: number;
  onProgress?: (ev: ImportProgressEvent) => void | Promise<void>;
  sceneImportTotal: { value: number };
};

export async function runSequentialLibraryImports(args: RunLibraryImportArgs): Promise<{
  paths: string[];
  imported: number;
}> {
  const { count, onProgress, stepNumber } = args;
  console.log(
    `AGENT: Library auto-import disabled (relay removed); step ${stepNumber}, requested ${count}`
  );
  await onProgress?.({
    asset: "(use workspace 3D Library)",
    source: "none",
    current: 0,
    total: count,
  });
  return { paths: [], imported: 0 };
}
