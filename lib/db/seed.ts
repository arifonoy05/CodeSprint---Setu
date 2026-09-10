import { hash } from '@node-rs/argon2'
import { sql } from './client.ts'
import { migrate } from './migrate.ts'
import type { Role } from '../auth/roles.ts'

/** D14: users are seeded by script — no signup flow, no user management UI. */
const USERS: { email: string; name: string; role: Role }[] = [
  { email: 'admin@bracits.com', name: 'System Admin', role: 'superadmin' },
  { email: 'ba@bracits.com', name: 'Anindo Dey', role: 'ba' },
  { email: 'dev@bracits.com', name: 'Dev Lead', role: 'dev' },
  { email: 'qa@bracits.com', name: 'QA Lead', role: 'qa' },
  { email: 'pm@bracits.com', name: 'Delivery Manager', role: 'pm' },
]

const password = process.env.SEED_PASSWORD ?? 'setu-demo-password'

await migrate()
for (const u of USERS) {
  await sql`
    INSERT INTO users (email, name, role, password_hash)
    VALUES (${u.email}, ${u.name}, ${u.role}, ${await hash(password)})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`
  console.log(`  ${u.role.padEnd(11)} ${u.email}`)
}
console.log(`\npassword for all seeded users: ${password}`)
await sql.end()
