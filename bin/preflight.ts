/**
 * Migrations before the app or worker starts.
 *
 * This used to refuse to boot against a public model endpoint (D31). The endpoint now
 * lives in the database and is set through Settings, so a boot-time check on an
 * environment variable would test the wrong thing — and would make the app unstartable
 * precisely when someone needs to open Settings and fix it. The check still runs, at the
 * point where it can do something useful: the connection test, which records whether the
 * endpoint is private and requires an explicit acknowledgement when it is not.
 */
import { migrate } from '../lib/db/migrate.ts'
import { sql } from '../lib/db/client.ts'

if (process.argv.includes('--migrate')) {
  await migrate()
}
await sql.end()
