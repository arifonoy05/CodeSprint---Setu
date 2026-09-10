import OpenAI from 'openai'
import { assertPrivateEndpoint } from '../egress.ts'
import { env } from '../env.ts'
import { adviseUrl, detectGateway, type UrlAdvice, type GatewaySignal } from './network.ts'

export type TestReport = {
  ok: boolean
  isPrivate: boolean
  resolvedNote: string
  models?: string[]
  chatOk: boolean
  chatSeconds?: number
  jsonSchemaOk: boolean
  reasoningOffOk: boolean
  embedDims?: number
  errors: string[]
  /** Set when the URL cannot work from where the call is made (e.g. loopback in a container). */
  advice?: UrlAdvice
  /** A private address that appears to resell third-party models. */
  gateway?: GatewaySignal
}

/**
 * Just the model list — cheap, and lets the form offer what the endpoint actually has
 * instead of asking someone to type a model id from memory.
 */
export async function listModels(baseUrl: string, apiKey: string): Promise<
  { ok: true; chat: string[]; embed: string[] } | { ok: false; error: string }
> {
  try {
    const client = new OpenAI({ baseURL: baseUrl, apiKey: apiKey || 'not-needed', maxRetries: 0, timeout: 20_000 })
    const ids = (await client.models.list()).data.map((m) => m.id)
    // Endpoints rarely say which is which, so split on the one signal they all share.
    const embed = ids.filter((i) => /embed/i.test(i))
    return { ok: true, chat: ids.filter((i) => !embed.includes(i)), embed }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

const SCHEMA = {
  type: 'json_schema',
  json_schema: { name: 'probe', strict: true, schema: { type: 'object',
    properties: { gap: { type: 'string' }, evidence_ids: { type: 'array', items: { type: 'string' } } },
    required: ['gap', 'evidence_ids'], additionalProperties: false } },
}

/**
 * Checks the three things Setu actually depends on, not merely that the endpoint answers.
 * "OpenAI-compatible" implies none of them, and each failure would otherwise surface
 * minutes into an analysis run.
 */
export async function testModelEndpoint(input: {
  baseUrl: string; apiKey: string; chatModel: string; embedModel: string; reasoningEffort: string
  /** Blank means "same endpoint as chat". */
  embedBaseUrl?: string; embedApiKey?: string
}): Promise<TestReport> {
  const r: TestReport = {
    ok: false, isPrivate: false, resolvedNote: '', chatOk: false,
    jsonSchemaOk: false, reasoningOffOk: false, errors: [],
  }

  try {
    await assertPrivateEndpoint(input.baseUrl, 'The endpoint')
    r.isPrivate = true
    r.resolvedNote = 'Resolves inside your network.'
  } catch (err) {
    r.isPrivate = false
    r.resolvedNote = (err as Error).message
  }

  const client = new OpenAI({
    baseURL: input.baseUrl, apiKey: input.apiKey || 'not-needed', maxRetries: 0, timeout: 60_000,
  })

  try {
    r.models = (await client.models.list()).data.map((m) => m.id)
  } catch (err) {
    r.errors.push(`Cannot list models: ${(err as Error).message}`)
    // A loopback address from inside a container is the most common cause, and the bare
    // error says nothing useful about it.
    r.advice = adviseUrl(input.baseUrl)
    return r
  }
  r.gateway = detectGateway(r.models)
  if (r.gateway.likely && r.isPrivate) {
    r.resolvedNote += ` It offers ${r.gateway.modelCount} models` +
      (r.gateway.vendors.length ? ` including ${r.gateway.vendors.slice(0, 4).join(', ')}` : '') +
      `, so it appears to forward to providers outside your network. The address check only sees the first hop.`
  }
  if (r.models.length && !r.models.includes(input.chatModel)) {
    r.errors.push(`Chat model "${input.chatModel}" is not offered by this endpoint.`)
  }

  try {
    const t0 = Date.now()
    const res = await client.chat.completions.create({
      model: input.chatModel,
      messages: [{ role: 'user', content: 'Evidence: [R-1041] a retry causes a double posting.\nName one unspecified failure path. Cite only the ids shown.' }],
      response_format: SCHEMA as never,
      ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
    } as never)
    r.chatSeconds = (Date.now() - t0) / 1000
    r.chatOk = true
    const msg = res.choices[0]?.message as any
    const content = msg?.content ?? ''
    try { JSON.parse(content); r.jsonSchemaOk = true }
    catch { r.errors.push('Structured output (json_schema) was not honoured — findings would not parse.') }
    const reasoning = (msg?.reasoning ?? msg?.reasoning_content ?? '') as string
    r.reasoningOffOk = input.reasoningEffort !== 'none' || reasoning.length === 0
    if (!r.reasoningOffOk) {
      r.errors.push('reasoning_effort was ignored — runs will be far slower (measured 215s vs 4s per call).')
    }
  } catch (err) {
    r.errors.push(`Chat call failed: ${(err as Error).message.slice(0, 200)}`)
  }

  // Embeddings may live elsewhere — gateways commonly serve chat only.
  const embedClient = input.embedBaseUrl
    ? new OpenAI({ baseURL: input.embedBaseUrl, apiKey: input.embedApiKey || 'not-needed', maxRetries: 0, timeout: 60_000 })
    : client
  try {
    const e = await embedClient.embeddings.create({
      model: input.embedModel, input: 'loan disbursement retry', encoding_format: 'float',
    })
    r.embedDims = e.data[0]!.embedding.length
    if (r.embedDims !== env.embedDims) {
      r.errors.push(`Embeddings are ${r.embedDims}-dimensional; the database stores vector(${env.embedDims}). This needs a migration and a full re-index.`)
    }
  } catch (err) {
    const where = input.embedBaseUrl ? input.embedBaseUrl : 'the chat endpoint'
    r.errors.push(`Embeddings failed at ${where}: ${(err as Error).message.slice(0, 160)}`)
  }

  r.ok = r.chatOk && r.jsonSchemaOk && r.errors.length === 0
  return r
}
