import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

const RUN = 9
const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
}
const push = async (email: string, qs: string) => {
  const res = await fetch(`http://127.0.0.1:3000/api/runs/${RUN}/push${qs}`,
    { method: 'POST', headers: { cookie: await cookieFor(email) } })
  return { status: res.status, body: await res.json() as any }
}

console.log('RBAC:')
console.log(`  dev  -> ${(await push('dev@bracits.com', '?dryRun=true')).status}`)
console.log(`  qa   -> ${(await push('qa@bracits.com', '?dryRun=true')).status}`)
console.log(`  pm   -> ${(await push('pm@bracits.com', '?dryRun=true')).status}`)

const dry = await push('ba@bracits.com', '?dryRun=true')
console.log(`\ndry run -> HTTP ${dry.status}`)
console.log(`  enabled=${dry.body.enabled} target=${dry.body.target} project=${dry.body.project}`)
console.log(`  ${dry.body.issueCount} issues would be created`)
const first = dry.body.issues[0]
console.log(`\n  first issue: ${first.fields.issuetype.name} — ${first.fields.summary.slice(0, 70)}`)
console.log(`  labels: ${first.fields.labels.join(', ')}`)
console.log(`  source: ${first._source}`)
console.log('  description (first 6 lines):')
first.fields.description.split('\n').slice(0, 6).forEach((l: string) => console.log(`    ${l}`))

const real = await push('ba@bracits.com', '?dryRun=false')
console.log(`\nreal push with the flag off -> HTTP ${real.status}: ${real.body.error}`)
await sql.end()
