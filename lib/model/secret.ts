import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { env } from '../env.ts'

/**
 * API keys are credentials at a trust boundary, so they are encrypted at rest rather
 * than stored as plaintext in a column any read of the table would expose.
 *
 * AES-256-GCM, key derived from SESSION_SECRET. Rotating that secret makes existing keys
 * undecryptable — which surfaces as a failed connection test, not silent breakage.
 */
const key = () => scryptSync(env.sessionSecret, 'setu-model-key', 32)

export function encryptSecret(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function decryptSecret(stored: string | null): string {
  if (!stored) return ''
  try {
    const [iv, tag, data] = stored.split('.')
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv!, 'base64'))
    d.setAuthTag(Buffer.from(tag!, 'base64'))
    return Buffer.concat([d.update(Buffer.from(data!, 'base64')), d.final()]).toString('utf8')
  } catch {
    return '' // wrong secret or tampered value — treated as no key
  }
}

/** Never show a key back to the browser; show enough to recognise it. */
export const maskSecret = (plain: string) =>
  !plain ? '' : plain.length <= 8 ? '••••' : `${plain.slice(0, 4)}••••${plain.slice(-4)}`
