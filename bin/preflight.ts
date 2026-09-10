/**
 * D31: refuse to start against a public model endpoint.
 *
 * Runs as a step before next dev/start and before the worker — deliberately outside the
 * bundler. Next compiles instrumentation.ts for the edge runtime as well as node, and
 * node:dns cannot be bundled for edge, so the idiomatic hook cannot host this check.
 * A preflight process is simpler anyway: one guarantee, one place, every entry point.
 */
import { assertEgressPolicy } from '../lib/egress.ts'
import { migrate } from '../lib/db/migrate.ts'
import { sql } from '../lib/db/client.ts'

await assertEgressPolicy()

if (process.argv.includes('--migrate')) {
  await migrate()
}
await sql.end()
