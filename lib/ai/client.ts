import OpenAI from 'openai'
import { env } from '../env.ts'
import { getModelConfig } from '../model/config.ts'

/**
 * D7: OpenAI-compatible /v1, so the endpoint can be anything that speaks it.
 *
 * The endpoint is configured in the app (Settings → Model) rather than the environment,
 * so it can be changed and tested without a redeploy. The environment is only a bootstrap
 * for a fresh install.
 *
 * Built per call rather than once at import: the configuration can change while the
 * process is running, and a cached client would keep talking to the old endpoint.
 */
export async function getLlm(): Promise<{ client: OpenAI; chatModel: string; embedModel: string; reasoningEffort: string }> {
  const c = await getModelConfig()
  return {
    client: new OpenAI({ baseURL: c.baseUrl, apiKey: c.apiKey || 'not-needed' }),
    chatModel: c.chatModel,
    embedModel: c.embedModel,
    reasoningEffort: c.reasoningEffort,
  }
}

/** D7: measured 215s -> 4s with reasoning off. */
export const reasoningParam = (effort: string) =>
  effort ? ({ reasoning_effort: effort } as Record<string, unknown>) : {}

export async function llmReachable(): Promise<{ ok: boolean; models?: string[]; error?: string; baseUrl: string }> {
  const c = await getModelConfig()
  try {
    const { client } = await getLlm()
    const res = await client.models.list()
    return { ok: true, models: res.data.map((m) => m.id), baseUrl: c.baseUrl }
  } catch (err) {
    return { ok: false, error: (err as Error).message, baseUrl: c.baseUrl }
  }
}

/** Kept for the few places that only need the configured names. */
export const envDefaults = { embedDims: env.embedDims }
