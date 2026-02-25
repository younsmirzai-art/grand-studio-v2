/**
 * Extract Python code from AI response. Handles multiple formats:
 * - ```python ... ```
 * - ```py ... ```
 * - Generic ``` with content starting with import unreal
 * - Raw code (no backticks) starting with import unreal
 */
export function extractPythonCode(response: string): string | null {
  if (!response || typeof response !== "string") return null;

  const trimmed = response.trim();
  if (!trimmed) return null;

  // Try ```python first
  let match = trimmed.match(/```python\n?([\s\S]*?)```/);
  if (match) return match[1].trim();

  // Try ```py
  match = trimmed.match(/```py\n?([\s\S]*?)```/);
  if (match) return match[1].trim();

  // Try generic ``` block that starts with import unreal
  match = trimmed.match(/```\n?(import unreal[\s\S]*?)```/);
  if (match) return match[1].trim();

  // Try raw code (no backticks) starting with import unreal
  match = trimmed.match(/(import unreal[\s\S]*)/);
  if (match) return match[1].trim();

  return null;
}
