export function formatFileSizeBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const d = i === 0 || v >= 10 ? 0 : 1;
  return `${v.toFixed(d)} ${units[i]}`;
}
