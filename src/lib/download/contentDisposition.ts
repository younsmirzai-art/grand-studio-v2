/** RFC 5987 attachment filename for binary responses. */
export function attachmentContentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_") || "download.bin";
  const star = encodeURIComponent(fileName);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`;
}
