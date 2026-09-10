import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session.ts'
import { sql } from '@/lib/db/client.ts'

export const dynamic = 'force-dynamic'

/** D22: opens the stored run instead of generating a new one. */
export default async function Demo() {
  await requireUser()
  const [run] = await sql<{ id: number }[]>`
    SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
  if (!run) {
    return (
      <main>
        <h1>No stored run</h1>
        <p>Seed one with <code>npm run seed:demo</code>.</p>
      </main>
    )
  }
  redirect(`/runs/${run.id}`)
}
