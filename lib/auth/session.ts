import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { env } from '../env.ts'
import { can, type GatedAction, type Role } from './roles.ts'

export type SessionUser = { id: number; email: string; name: string; role: Role }
type SetuSession = { user?: SessionUser }

const options: SessionOptions = {
  password: env.sessionSecret,
  cookieName: 'setu_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    // A secure cookie is dropped over plain HTTP, so sign-in silently fails. Deployed on a
    // local network there is no certificate to have — hence an opt-out, not a default:
    // anything reachable from outside the LAN needs TLS and must leave this unset.
    secure: process.env.NODE_ENV === 'production' && process.env.SETU_ALLOW_HTTP !== 'true',
  },
}

export async function getSession() {
  return getIronSession<SetuSession>(await cookies(), options)
}

export async function currentUser(): Promise<SessionUser | null> {
  return (await getSession()).user ?? null
}

/** Read is open to any signed-in user (D10). */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

/** Only the three gated action classes need this (D10). */
export async function requireCan(action: GatedAction): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user.role, action)) {
    throw new Error(`${user.role} is not permitted to ${action}`)
  }
  return user
}
