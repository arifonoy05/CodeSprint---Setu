import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return { role: u.role, cookie: `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}` }
}
const [demo] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
const RUN = demo.id

const LABELS = ['Findings', 'Stories', 'Tasks', 'Tests', 'Traceability']

for (const email of ['ba@bracits.com', 'dev@bracits.com', 'qa@bracits.com', 'pm@bracits.com', 'admin@bracits.com']) {
  const { role, cookie } = await cookieFor(email)
  const html = await (await fetch(`http://127.0.0.1:3000/runs/${RUN}`, { headers: { cookie } })).text()
  const present = LABELS.filter((l) => html.includes(`>${l}`) || html.includes(`${l}<`))
  const top = ['Runs', 'Health', 'Model'].filter((l) => new RegExp(`>\\s*${l}\\s*<`).test(html))
  const youBadge = /badge-primary[^>]*>you</.test(html)
  console.log(`${role.padEnd(11)} run tabs: [${present.join(' ')}]  top: [${top.join(' ')}]  "you" marker: ${youBadge}`)
}

console.log('\nany role can open any view (D10):')
for (const email of ['qa@bracits.com', 'dev@bracits.com']) {
  const { role, cookie } = await cookieFor(email)
  for (const view of ['tasks', 'tests', 'all']) {
    const html = await (await fetch(`http://127.0.0.1:3000/runs/${RUN}/backlog?view=${view}`, { headers: { cookie } })).text()
    const tasks = /Development tasks/.test(html), tests = /Test scenarios/.test(html)
    const criteria = /<b>Given<\/b>/.test(html)
    console.log(`  ${role} ?view=${view.padEnd(5)} -> tasks:${tasks ? 'y' : 'n'} tests:${tests ? 'y' : 'n'} criteria:${criteria ? 'y' : 'n'}`)
  }
}
await sql.end()
