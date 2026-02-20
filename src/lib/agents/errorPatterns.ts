/**
 * Common UE5 Python error patterns and optional auto-fixes.
 * Used before sending errors to Morgan for smart debugging.
 */

export interface ErrorPattern {
  pattern: RegExp;
  suggestion: string;
  autoFix: ((code: string) => string) | null;
}

export const commonUE5Errors: ErrorPattern[] = [
  {
    pattern: /object\s+not\s+found|asset\s+not\s+found|path\s+not\s+found/i,
    suggestion: "Asset or object path may be wrong; use /Engine/BasicShapes/ for basic meshes.",
    autoFix: (code) => {
      // If code references /Game/ or custom path for static mesh, suggest BasicShapes
      if (/load_asset|load_object|StaticMesh\(['\"][^'\"]+['\"]\)/i.test(code)) {
        return code.replace(
          /StaticMesh\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/gi,
          "StaticMesh('/Engine/BasicShapes/Cube.Cube')"
        );
      }
      return code;
    },
  },
  {
    pattern: /cannot\s+call\s+.*\s+on\s+None|'NoneType'\s+object|NoneType/,
    suggestion: "An actor or object is None; add a None check before using it.",
    autoFix: (code) => {
      // Add a simple guard: if spawn returns None, log and return early
      if (code.includes("spawn_actor") && !code.includes("if ") && !code.includes("None")) {
        const lines = code.split("\n");
        const out: string[] = [];
        for (const line of lines) {
          out.push(line);
          if (/spawn_actor|spawn_object/.test(line) && !line.trim().startsWith("#")) {
            const varMatch = line.match(/^\s*(\w+)\s*=/);
            if (varMatch) {
              const varName = varMatch[1];
              out.push(`if ${varName} is None:\n    unreal.log_error("Failed to spawn")\n    raise RuntimeError("Spawn returned None")`);
            }
          }
        }
        return out.join("\n");
      }
      return code;
    },
  },
  {
    pattern: /attribute\s+error|AttributeError|has no attribute|'NoneType'/i,
    suggestion: "Wrong method or property name, or object is None; check UE5 Python API.",
    autoFix: null,
  },
  {
    pattern: /no\s+module\s+named|ModuleNotFoundError/i,
    suggestion: "Only UE5 built-in modules are allowed; do not use pip packages.",
    autoFix: (code) => {
      // Remove common invalid imports
      return code
        .replace(/^\s*import\s+\w+\s*$/gm, (m) => (m.includes("unreal") ? m : "# " + m))
        .replace(/^\s*from\s+\w+\s+import\s+.*$/gm, (m) => (m.includes("unreal") ? m : "# " + m));
    },
  },
  {
    pattern: /timeout|timed\s+out|execution\s+timeout/i,
    suggestion: "Execution took too long; simplify the script or run in smaller steps.",
    autoFix: null,
  },
  {
    pattern: /permission\s+denied|access\s+denied|read-only/i,
    suggestion: "Check if editor is in the correct mode; ensure PIE or editor is ready.",
    autoFix: null,
  },
  {
    pattern: /level\s+not\s+found|world\s+not\s+found/i,
    suggestion: "Level or world path is wrong; verify with EditorAssetLibrary.",
    autoFix: null,
  },
  {
    pattern: /material\s+not\s+found|texture\s+not\s+found/i,
    suggestion: "Don't load external materials; use default materials or BasicShapes.",
    autoFix: null,
  },
  {
    pattern: /plugin\s+not\s+enabled|plugin\s+disabled/i,
    suggestion: "Required plugin may not be active; use only plugins listed in context.",
    autoFix: null,
  },
];

/**
 * Try to fix code using the first matching pattern's autoFix.
 * Returns fixed code or null if no auto-fix applied.
 */
export function quickFix(code: string, errorMessage: string): string | null {
  for (const { pattern, autoFix } of commonUE5Errors) {
    if (pattern.test(errorMessage) && autoFix) {
      const fixed = autoFix(code);
      if (fixed !== code) return fixed;
    }
  }
  return null;
}
