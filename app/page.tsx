import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/session.ts'
import { LANDING } from '@/lib/auth/roles.ts'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await currentUser()
  redirect(user ? LANDING[user.role] : '/login')
}
