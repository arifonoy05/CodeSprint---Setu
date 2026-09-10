import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
import { modelBlocker, getModelConfig } from '../lib/model/config.ts'
import { testModelEndpoint } from '../lib/model/test.ts'
import { encryptSecret, decryptSecret, maskSecret } from '../lib/model/secret.ts'

const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
}
const page = async (path: string, email: string) => {
  const r = await fetch(`http://127.0.0.1:3000${path}`, { headers: { cookie: await cookieFor(email) }, redirect: 'manual' })
  return `${r.status}${r.headers.get('location') ? ' -> ' + r.headers.get('location') : ''}`
}

console.log('RBAC on the settings page:')
console.log(`  superadmin ${await page('/settings/model', 'admin@bracits.com')}`)
console.log(`  ba         ${await page('/settings/model', 'ba@bracits.com')}`)
console.log(`  qa         ${await page('/settings/model', 'qa@bracits.com')}`)

console.log('\nwith nothing configured, is the app blocked?')
await sql`DELETE FROM model_config`
console.log(`  blocker: ${JSON.stringify(await modelBlocker())}`)
const up = await fetch('http://127.0.0.1:3000/api/documents', {
  method: 'POST', headers: { cookie: await cookieFor('ba@bracits.com') }, body: new FormData() })
console.log(`  upload endpoint: HTTP ${up.status} ${(await up.text()).slice(0, 90)}`)

console.log('\nsecret round-trip:')
const k = 'sk-test-abcdef0123456789'
const enc = encryptSecret(k)
console.log(`  encrypted looks like: ${enc.slice(0, 28)}…  (${enc.length} chars)`)
console.log(`  decrypts back:        ${decryptSecret(enc) === k}`)
console.log(`  masked for display:   ${maskSecret(k)}`)
console.log(`  plaintext in stored?  ${enc.includes(k) ? 'YES — BUG' : 'no'}`)

console.log('\nconnection test against the real local endpoint:')
const rep = await testModelEndpoint({
  baseUrl: 'http://host.docker.internal:1234/v1', apiKey: '',
  chatModel: 'qwen/qwen3.5-9b', embedModel: 'text-embedding-nomic-embed-text-v1.5',
  reasoningEffort: 'none',
})
console.log(`  ok=${rep.ok} private=${rep.isPrivate} chat=${rep.chatOk} json_schema=${rep.jsonSchemaOk} ` +
            `reasoning=${rep.reasoningOffOk} dims=${rep.embedDims} ${rep.chatSeconds?.toFixed(1)}s`)
if (rep.errors.length) console.log(`  errors: ${rep.errors.join(' | ')}`)

console.log('\nconnection test against a PUBLIC endpoint:')
const pub = await testModelEndpoint({
  baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-invalid',
  chatModel: 'gpt-4o-mini', embedModel: 'text-embedding-3-small', reasoningEffort: 'none',
})
console.log(`  private=${pub.isPrivate}  note: ${pub.resolvedNote.slice(0, 80)}…`)
await sql.end()
