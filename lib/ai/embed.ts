import { getEmbedder } from './client.ts'
import { env } from '../env.ts'

/**
 * Same OpenAI-compatible endpoint as chat (D7). LM Studio serves both.
 *
 * `encoding_format: 'float'` is REQUIRED, not a preference. The OpenAI SDK requests
 * base64 by default, and decoding LM Studio's response that way silently yields
 * 192-dim vectors instead of 768 — a well-formed response, no error, and every
 * retrieval result quietly wrong. Measured: SDK default 192, explicit float 768,
 * raw fetch 768.
 */
const BATCH = 32

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  const { client, embedModel } = await getEmbedder()
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await client.embeddings.create({
      model: embedModel,
      input: texts.slice(i, i + BATCH),
      encoding_format: 'float',
      // Asks a wider model to return our width — OpenAI's text-embedding-3-* and the gateways
      // that forward this honour it, which is the difference between a 1536-dim model being
      // usable and being rejected. A server that does not support it fails at the connection
      // test, where the error is read, rather than silently returning the wrong width.
      dimensions: env.embedDims,
    })
    for (const d of [...res.data].sort((a, b) => a.index - b.index)) {
      const v = d.embedding as number[]
      // Width is load-bearing: a wrong-width vector is not an error anywhere else.
      if (v.length !== env.embedDims) {
        throw new Error(
          `embedding model returned ${v.length} dims, schema expects ${env.embedDims}. ` +
            `Changing embedding model is a migration, not an env change.`,
        )
      }
      out.push(v)
    }
  }
  return out
}

export const toVector = (v: number[]) => `[${v.join(',')}]`
