import { readFile } from 'node:fs/promises'
import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

/** Drive the real server action, the way the form does. */
const manifest = JSON.parse(await readFile('/tmp/srm.json', 'utf8')).node as Record<string, any>
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE role='superadmin' LIMIT 1`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const idFor = (n: string) => Object.entries(manifest).find(([, v]) => v.exportedName === n)?.[0]

const call = async (name: string, args: unknown[]) => {
  const id = idFor(name)
  if (!id) return { note: `action ${name} not in manifest (rebuild)` }
  const res = await fetch('http://127.0.0.1:3000/settings/model', {
    method: 'POST',
    headers: { 'Next-Action': id, 'Content-Type': 'text/plain;charset=UTF-8', cookie },
    body: JSON.stringify(args),
  })
  return { status: res.status, body: (await res.text()).slice(-700) }
}

for (const url of ['http://localhost:1234/v1', 'http://127.0.0.1:1234/v1', 'http://host.docker.internal:1234/v1']) {
  const r: any = await call('fetchModels', [url, ''])
  const advised = /host\.docker\.internal/.test(r.body ?? '') && /container itself/.test(r.body ?? '')
  const ok = /"ok":true/.test(r.body ?? '')
  console.log(`${url.padEnd(38)} ok=${ok}  advice-shown=${advised}`)
}
await sql.end()
