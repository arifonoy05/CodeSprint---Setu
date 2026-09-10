import OpenAI from 'openai'
import { env } from '../env.ts'

/**
 * D7: OpenAI-compatible /v1. Verified against Ollama and LM Studio; vLLM or a gateway is
 * an env change, not a code change.
 *
 * A gateway that ROUTES to external providers would satisfy D31's private-address check
 * while still sending client business logic off the network — the check sees the first
 * hop, not the destination. Only point this at models the endpoint hosts itself.
 */
export const llm = new OpenAI({
  baseURL: env.llmBaseUrl,
  apiKey: env.llmApiKey || 'not-needed', // local servers ignore it; gateways require it
})

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
