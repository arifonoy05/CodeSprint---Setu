import postgres from 'postgres'
import { env } from '../env.ts'

export const sql = postgres(env.databaseUrl, { max: 10, onnotice: () => {} })
