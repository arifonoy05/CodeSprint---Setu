import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from './client.ts'

/**
 * Plain SQL files applied in order, tracked in a table.
 * ponytail: no migration framework — a dozen files and one loop does not need one.
 */
export async function migrate(): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`

  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name as string))

  const applied: string[] = []
  for (const file of files) {
    if (done.has(file)) continue
    const ddl = await readFile(join(dir, file), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl)
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`
    })
    applied.push(file)
    console.log(`[migrate] applied ${file}`)
  }
  if (applied.length === 0) console.log('[migrate] up to date')
  return applied
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate()
  await sql.end()
}
