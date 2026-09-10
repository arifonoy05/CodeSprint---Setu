import PgBoss from 'pg-boss'
import { env } from './env.ts'

/** D5: pg-boss on the same Postgres. No second datastore, nothing extra to approve. */
export const QUEUE = 'setu.run' as const
export const GENERATE_QUEUE = 'setu.generate' as const
export type RunJob = { runId: number; documentId: number }
export type GenerateJob = { runId: number }

let boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss
  boss = new PgBoss({ connectionString: env.databaseUrl })
  boss.on('error', (err) => console.error('[boss]', err))
  await boss.start()
  await boss.createQueue(QUEUE).catch(() => {})
  return boss
}

export async function enqueueRun(job: RunJob) {
  const b = await getBoss()
  // Retries matter here: the model lives on another machine over a tunnel that can drop
  // or a laptop that can sleep mid-run (D34).
  return b.send(QUEUE, job, { retryLimit: 2, retryDelay: 10, expireInMinutes: 60 })
}

export async function enqueueGenerate(job: GenerateJob) {
  const b = await getBoss()
  return b.send(GENERATE_QUEUE, job, { retryLimit: 2, retryDelay: 10, expireInMinutes: 60 })
}
