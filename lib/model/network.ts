import { existsSync } from 'node:fs'

/**
 * The endpoint URL is resolved by whoever makes the call — the container, not the browser.
 * Inside a container `127.0.0.1` is the container itself, so a model running on the host
 * is unreachable at loopback and the failure reads as a bare "Connection error".
 *
 * Detecting that and saying so turns a confusing dead end into a one-click fix.
 */
export const inContainer = (): boolean =>
  existsSync('/.dockerenv') || process.env.SETU_IN_CONTAINER === 'true'

const LOOPBACK = /^(localhost|127(\.\d+){3}|::1|0\.0\.0\.0)$/i

/** The host alias Docker provides for "the machine running the container". */
export const HOST_ALIAS = 'host.docker.internal'

export type UrlAdvice = { problem: string; suggestion: string } | null

/**
 * Advice for a URL that cannot work from where the call is actually made.
 * Suggests, never rewrites — silently changing what someone typed is worse than saying why.
 */
export function adviseUrl(rawUrl: string): UrlAdvice {
  if (!inContainer()) return null
  let u: URL
  try { u = new URL(rawUrl) } catch { return null }
  if (!LOOPBACK.test(u.hostname)) return null

  const fixed = new URL(rawUrl)
  fixed.hostname = HOST_ALIAS
  return {
    problem: `Setu runs in a container, where ${u.hostname} is the container itself — not the machine ` +
             `your browser is on. A model running outside the container is not reachable there.`,
    suggestion: fixed.toString().replace(/\/$/, rawUrl.endsWith('/') ? '/' : ''),
  }
}
