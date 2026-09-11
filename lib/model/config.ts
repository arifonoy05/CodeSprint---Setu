import { sql } from '../db/client.ts'
import { env } from '../env.ts'
import { decryptSecret } from './secret.ts'
import { getPolicy } from './policy.ts'

export type ModelConfig = {
  id: number | null
  baseUrl: string
  apiKey: string
  chatModel: string
  /** Blank means "same endpoint as chat". Gateways often serve chat only. */
  embedBaseUrl: string
  embedApiKey: string
  embedModel: string
  embedDims: number | null
  reasoningEffort: string
  isPrivate: boolean
  egressAcknowledged: boolean
  verifiedAt: Date | null
  lastError: string | null
  lastReport: Record<string, unknown> | null
  /** true when it came from env because nothing is configured yet */
  fromEnv: boolean
}

/**
 * The active configuration, or the environment as a bootstrap so a fresh install has
 * something to test against rather than an empty form.
 */
export async function getModelConfig(): Promise<ModelConfig> {
  const [row] = await sql<any[]>`SELECT * FROM model_config WHERE is_active LIMIT 1`
  if (!row) {
    return {
      id: null, baseUrl: env.llmBaseUrl, apiKey: env.llmApiKey,
      chatModel: env.llmModel, embedBaseUrl: '', embedApiKey: '',
      embedModel: env.embedModel, embedDims: null,
      reasoningEffort: env.reasoningEffort, isPrivate: true, egressAcknowledged: false,
      verifiedAt: null, lastError: null, lastReport: null, fromEnv: true,
    }
  }
  return {
    id: row.id, baseUrl: row.base_url, apiKey: decryptSecret(row.api_key_encrypted),
    chatModel: row.chat_model,
    embedBaseUrl: row.embed_base_url ?? '', embedApiKey: decryptSecret(row.embed_api_key_encrypted),
    embedModel: row.embed_model, embedDims: row.embed_dims,
    reasoningEffort: row.reasoning_effort, isPrivate: row.is_private,
    egressAcknowledged: row.egress_acknowledged, verifiedAt: row.verified_at,
    lastError: row.last_error, lastReport: row.last_report, fromEnv: false,
  }
}

export type Blocker = { reason: string; detail: string }

/**
 * Why the app is blocked, or null. Analysis makes dozens of model calls; starting one
 * against an endpoint that has never answered wastes minutes and fails halfway.
 */
export async function modelBlocker(): Promise<Blocker | null> {
  const c = await getModelConfig()
  if (c.fromEnv) {
    return { reason: 'No model configured',
             detail: 'Set the model endpoint and test the connection before running an analysis.' }
  }
  if (!c.verifiedAt) {
    return { reason: 'Model connection not verified',
             detail: c.lastError ?? 'Test the connection to confirm the endpoint answers.' }
  }
  // An endpoint is "external" if it sits outside the network, or forwards there.
  const forwards = (c.lastReport as any)?.gateway?.likely === true
  if (!c.isPrivate || forwards) {
    const policy = await getPolicy()
    if (!policy.allowExternal) {
      return {
        reason: 'External models are not permitted',
        detail: c.isPrivate
          ? 'This endpoint is on your network but resells third-party models, so prompts leave it. A superadmin must allow external models in Settings before it can be used.'
          : 'This endpoint is outside your network. A superadmin must allow external models in Settings before it can be used.',
      }
    }
  }
  if (c.embedDims && c.embedDims !== env.embedDims) {
    return { reason: `Embedding width mismatch (${c.embedDims} vs ${env.embedDims})`,
             detail: `The database stores vector(${env.embedDims}). A different embedding model needs a migration and a full re-index.` }
  }
  return null
}
