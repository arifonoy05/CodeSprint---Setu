import { sql } from '../lib/db/client.ts'
import { testModelEndpoint } from '../lib/model/test.ts'
import { modelBlocker, getModelConfig } from '../lib/model/config.ts'
import { encryptSecret } from '../lib/model/secret.ts'

// From the host the endpoint is 127.0.0.1; inside the container it is host.docker.internal.
const url = process.env.PROBE_URL ?? 'http://127.0.0.1:1234/v1'
const rep = await testModelEndpoint({
  baseUrl: url, apiKey: '', chatModel: 'qwen/qwen3.5-9b',
  embedModel: 'text-embedding-nomic-embed-text-v1.5', reasoningEffort: 'none',
})
console.log(`test ${url}`)
console.log(`  ok=${rep.ok} private=${rep.isPrivate} chat=${rep.chatOk} json_schema=${rep.jsonSchemaOk} ` +
            `reasoning=${rep.reasoningOffOk} dims=${rep.embedDims} ${rep.chatSeconds?.toFixed(1)}s`)
if (rep.errors.length) console.log(`  errors: ${rep.errors.join(' | ')}`)

// Persist what the app will actually use (container-side hostname).
const [admin] = await sql<any[]>`SELECT id FROM users WHERE role='superadmin' LIMIT 1`
await sql`UPDATE model_config SET is_active=false WHERE is_active`
await sql`
  INSERT INTO model_config (base_url, api_key_encrypted, chat_model, embed_model, embed_dims,
                            reasoning_effort, is_private, egress_acknowledged, verified_at,
                            verified_by, last_report, is_active)
  VALUES ('http://host.docker.internal:1234/v1', ${encryptSecret('')||null}, 'qwen/qwen3.5-9b',
          'text-embedding-nomic-embed-text-v1.5', ${rep.embedDims ?? null}, 'none', true, false,
          ${rep.ok ? new Date() : null}, ${admin.id}, ${sql.json(rep as never)}, true)`
console.log(`\nsaved. blocker now: ${JSON.stringify(await modelBlocker())}`)
const c = await getModelConfig()
console.log(`config in use: ${c.baseUrl} · ${c.chatModel} · verified=${Boolean(c.verifiedAt)} · fromEnv=${c.fromEnv}`)
await sql.end()
