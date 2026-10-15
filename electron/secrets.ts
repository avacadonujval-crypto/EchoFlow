/**
 * Main-process only. Never expose via IPC / renderer / Settings UI.
 * The key stays in the local environment file and is never stored in the repo.
 */
export function getGeminiApiKeys(): string[] {
  const fromEnv = process.env.ECHOFLOW_GEMINI_API_KEY?.trim()
  return fromEnv ? [fromEnv] : []
}

export function getGeminiApiKey(): string {
  return getGeminiApiKeys()[0] ?? ''
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKeys().length > 0
}
