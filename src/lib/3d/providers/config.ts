/**
 * 3D generation provider config from environment.
 * Do not hardcode secrets.
 */

export function getMasterpieceConfig(): {
  apiKey: string | undefined;
  baseUrl: string;
} {
  const apiKey = process.env.MASTERPIECE_API_KEY;
  const baseUrl =
    process.env.MASTERPIECE_BASE_URL?.replace(/\/$/, "") ||
    "https://api.genai.masterpiecex.com/v2";
  return { apiKey, baseUrl };
}

export function isMasterpieceConfigured(): boolean {
  return !!getMasterpieceConfig().apiKey;
}

export function getMeshyConfig(): { apiKey: string | undefined } {
  return { apiKey: process.env.MESHY_API_KEY };
}

export function isMeshyConfigured(): boolean {
  return !!getMeshyConfig().apiKey;
}
