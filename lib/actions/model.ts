'use server'

import { revalidatePath } from 'next/cache'
import { sql } from '../db/client.ts'
import { requireUser } from '../auth/session.ts'
import { can } from '../auth/roles.ts'
import { audit } from '../auth/audit.ts'
import { encryptSecret, maskSecret } from '../model/secret.ts'
import { getModelConfig } from '../model/config.ts'
import { testModelEndpoint, listModels, type TestReport } from '../model/test.ts'

export type ModelInput = {
  baseUrl: string
  apiKey: string          // '' means "keep the stored key"
  clearApiKey?: boolean
  chatModel: string
  embedModel: string
  reasoningEffort: string
  egressAcknowledged: boolean
}

async function assertMayConfigure() {
  const user = await requireUser()
  if (!can(user.role, 'model:configure')) {
    throw new Error(`${user.role} is not permitted to change the model endpoint`)
  }
  return user
}

/** Resolve the key to use: a newly typed one, an explicit clear, or the stored one. */
async function resolveKey(input: ModelInput): Promise<string> {
  if (input.clearApiKey) return ''
  if (input.apiKey) return input.apiKey
  return (await getModelConfig()).apiKey
}

/** Ask the endpoint what it offers, so the form can present real choices. */
export async function fetchModels(baseUrl: string, apiKey: string) {
  await assertMayConfigure()
  const key = apiKey || (await getModelConfig()).apiKey
  return listModels(baseUrl, key)
}

/** Test without saving, so a bad endpoint never replaces a working one. */
export async function testModel(input: ModelInput): Promise<TestReport> {
  await assertMayConfigure()
  return testModelEndpoint({ ...input, apiKey: await resolveKey(input) })
}

/**
 * Save, then test. `verified_at` is set only by a passing test — the app stays blocked
 * on a configuration that has never answered, rather than failing minutes into a run.
 */
export async function saveModel(input: ModelInput): Promise<TestReport> {
  const user = await assertMayConfigure()
  const apiKey = await resolveKey(input)
  const report = await testModelEndpoint({ ...input, apiKey })
  const before = await getModelConfig()

  const verified = report.ok ? new Date() : null
  const error = report.ok ? null : report.errors.join(' · ') || 'Endpoint did not pass the connection test.'

  await sql`UPDATE model_config SET is_active = false WHERE is_active`
  await sql`
    INSERT INTO model_config (base_url, api_key_encrypted, chat_model, embed_model, embed_dims,
                              reasoning_effort, is_private, egress_acknowledged,
                              verified_at, verified_by, last_error, last_report, is_active, updated_at)
    VALUES (${input.baseUrl.trim()}, ${apiKey ? encryptSecret(apiKey) : null},
            ${input.chatModel.trim()}, ${input.embedModel.trim()}, ${report.embedDims ?? null},
            ${input.reasoningEffort}, ${report.isPrivate}, ${input.egressAcknowledged},
            ${verified}, ${verified ? user.id : null}, ${error},
            ${sql.json(report as never)}, true, now())`

  await audit({
    actorId: user.id, action: 'model:configure', entityType: 'model_config',
    before: { baseUrl: before.baseUrl, chatModel: before.chatModel, apiKey: maskSecret(before.apiKey) },
    after: { baseUrl: input.baseUrl, chatModel: input.chatModel, apiKey: maskSecret(apiKey),
             verified: report.ok, isPrivate: report.isPrivate },
  })

  revalidatePath('/settings/model')
  revalidatePath('/health')
  return report
}
