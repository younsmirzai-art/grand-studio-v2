export type ImportProgressEvent = {
  asset: string;
  source: "polyhaven" | "sketchfab" | "none";
  current: number;
  total: number;
};
