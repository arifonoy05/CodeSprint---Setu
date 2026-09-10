import OpenAI from 'openai'
import { env } from '../env.ts'

/**
 * D7: OpenAI-compatible /v1. Works against LM Studio today and vLLM later with an
 * env change and no code change. Verified on both Ollama and LM Studio.
 */
export const llm = new OpenAI({ baseURL: env.llmBaseUrl, apiKey: 'not-needed' })

/** D7: measured 215s -> 4s with reasoning off. Every call, always. */
export const REASONING = { reasoning_effort: env.reasoningEffort } as Record<string, unknown>

export async function llmReachable(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  try {
    const res = await llm.models.list()
    return { ok: true, models: res.data.map((m) => m.id) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
