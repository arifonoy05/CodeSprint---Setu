import { lookup } from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'
import { env } from './env.ts'

/**
 * D31: the app refuses to boot against a public model endpoint.
 *
 * The BRD's promise is that client business logic never leaves the network. That is a
 * property we can enforce rather than document — so this runs at startup and exits the
 * process instead of trusting configuration to stay correct.
 *
 * Server-only: imports node:dns. Never import this from a page or component.
 */

/** RFC1918 + loopback + link-local + CGNAT (Tailscale). */
export function isPrivateAddress(ip: string): boolean {
  if (isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fc') || v.startsWith('fd')) return true // unique local
    if (v.startsWith('fe80')) return true // link-local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) // IPv4-mapped
    return mapped ? isPrivateAddress(mapped[1]!) : false
  }
  if (!isIPv4(ip)) return false
  const [a, b] = ip.split('.').map(Number) as [number, number]
  if (a === 10 || a === 127) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT — Tailscale
  return false
}

export async function assertPrivateEndpoint(rawUrl: string, what = 'LLM_BASE_URL'): Promise<string> {
  let host: string
  try {
    host = new URL(rawUrl).hostname
  } catch {
    throw new Error(`${what} is not a valid URL: ${rawUrl}`)
  }
  // Docker's host alias resolves to the bridge gateway (RFC1918) inside a container,
  // but does not resolve at all outside one. Trust it by name.
  if (host === 'host.docker.internal') return host

  const bare = host.replace(/^\[|\]$/g, '')
  const addrs =
    isIPv4(bare) || isIPv6(bare)
      ? [{ address: bare }]
      : await lookup(bare, { all: true }).catch(() => {
          throw new Error(`${what} host does not resolve: ${host}`)
        })

  const publicAddrs = addrs.filter((a) => !isPrivateAddress(a.address))
  if (publicAddrs.length > 0) {
    throw new Error(
      `${what} resolves to a public address (${publicAddrs.map((a) => a.address).join(', ')}). ` +
        `Setu sends client business logic to this endpoint and will not do so over a public network. ` +
        `Use a reverse tunnel or VPN so it is reachable privately.`,
    )
  }
  return host
}

/** Called from instrumentation on boot. Exits the process on failure. */
export async function assertEgressPolicy(): Promise<void> {
  try {
    const host = await assertPrivateEndpoint(env.llmBaseUrl)
    console.log(`[egress] ok — model endpoint ${host} is private`)
  } catch (err) {
    console.error(`[egress] REFUSING TO START\n${(err as Error).message}`)
    process.exit(1)
  }
}
