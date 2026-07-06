// MOCK_MODE resolution. Default: ON when there is no ANTHROPIC_API_KEY, so the
// demo runs fully offline out of the box. Set MOCK_MODE=1 to force it on even
// when a key is present; set MOCK_MODE=0 with a key present to run the live model.
export function resolveMode(): { mock: boolean; apiKey?: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const forced = (process.env.MOCK_MODE ?? "").trim().toLowerCase();
  if (forced === "1" || forced === "true") return { mock: true, apiKey };
  if (forced === "0" || forced === "false") return { mock: !apiKey, apiKey };
  return { mock: !apiKey, apiKey };
}
