'use server'

import { verify } from '@node-rs/argon2'
import { redirect } from 'next/navigation'
import { sql } from '../db/client.ts'
import { getSession } from './session.ts'
import { audit } from './audit.ts'
import { LANDING, type Role } from './roles.ts'

export async function login(_prev: string | undefined, form: FormData): Promise<string | undefined> {
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')

  const [row] = await sql<{ id: number; email: string; name: string; role: Role; password_hash: string }[]>`
    SELECT id, email, name, role, password_hash FROM users WHERE email = ${email}`

  // Same message either way — never reveal whether an account exists.
  if (!row || !(await verify(row.password_hash, password))) {
    await audit({ actorId: row?.id ?? null, action: 'login:failed', entityType: 'user', entityId: row?.id ?? null })
    return 'Incorrect email or password.'
  }

  const session = await getSession()
  session.user = { id: row.id, email: row.email, name: row.name, role: row.role }
  await session.save()
  await audit({ actorId: row.id, action: 'login', entityType: 'user', entityId: row.id })
  redirect(LANDING[row.role])
}

export async function logout() {
  const session = await getSession()
  const id = session.user?.id ?? null
  session.destroy()
  await audit({ actorId: id, action: 'logout', entityType: 'user', entityId: id })
  redirect('/login')
}
