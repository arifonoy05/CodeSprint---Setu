import { assertEgressPolicy } from '../lib/egress.ts'
import { migrate } from '../lib/db/migrate.ts'
import { sql } from '../lib/db/client.ts'
import { getBoss, QUEUE, GENERATE_QUEUE, type RunJob, type GenerateJob } from '../lib/queue.ts'
import { processRun } from '../lib/pipeline/run.ts'
import { generateBacklog } from '../lib/pipeline/generate.ts'

await assertEgressPolicy() // D31 — the worker calls the model too
await migrate()

const boss = await getBoss()

await boss.work<RunJob>(QUEUE, { batchSize: 1 }, async ([job]) => {
  const { runId } = job!.data
  console.log(`[worker] run ${runId} starting`)
  try {
    await processRun(runId)
    console.log(`[worker] run ${runId} ready`)
  } catch (err) {
    // Mark the run failed so the UI can say so rather than spinning for ever.
    await sql`UPDATE runs SET status = 'failed', stage = NULL, error = ${(err as Error).message}
              WHERE id = ${runId}`
    console.error(`[worker] run ${runId} failed:`, (err as Error).message)
    throw err // let pg-boss retry (D34: tunnels drop, laptops sleep)
  }
})

await boss.work<GenerateJob>(GENERATE_QUEUE, { batchSize: 1 }, async ([job]) => {
  const { runId } = job!.data
  console.log(`[worker] generating backlog for run ${runId}`)
  try {
    await generateBacklog(runId)
    console.log(`[worker] run ${runId} backlog ready`)
  } catch (err) {
    await sql`UPDATE runs SET status = 'approved', stage = NULL, error = ${(err as Error).message}
              WHERE id = ${runId}`
    console.error(`[worker] run ${runId} generation failed:`, (err as Error).message)
    throw err
  }
})

console.log('[worker] ready')
process.on('SIGTERM', async () => { await boss.stop(); process.exit(0) })
