const DANGEROUS_PATTERNS = [
  /import\s+os/,
  /import\s+subprocess/,
  /import\s+sys/,
  /eval\s*\(/,
  /exec\s*\(/,
  /__import__/,
  /open\s*\(.*(w|a|x)/,
  /shutil\./,
  /pathlib.*unlink/,
  /os\.remove/,
  /os\.rmdir/,
];

const REQUIRED_PATTERNS = [
  /unreal|EditorLevelLibrary|EditorAssetLibrary|StaticMesh|Actor|remote/i,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateUE5Code(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!code.trim()) {
    errors.push("Code is empty");
    return { valid: false, errors, warnings };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Potentially dangerous pattern detected: ${pattern.source}`);
    }
  }

  const hasUE5Api = REQUIRED_PATTERNS.some((p) => p.test(code));
  if (!hasUE5Api) {
    warnings.push("Code doesn't appear to use UE5 APIs. Is this intended?");
  }

  try {
    let depth = 0;
    for (const char of code) {
      if (char === "(" || char === "[" || char === "{") depth++;
      if (char === ")" || char === "]" || char === "}") depth--;
      if (depth < 0) {
        errors.push("Mismatched brackets/parentheses");
        break;
      }
    }
    if (depth !== 0) {
      errors.push("Unclosed brackets/parentheses");
    }
  } catch {
    errors.push("Syntax check failed");
  }

  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("\t") && line.match(/^ /)) {
      warnings.push(`Line ${i + 1}: Mixed tabs and spaces`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
