'use client'
import { useActionState } from 'react'
import { login } from '@/lib/auth/actions.ts'

export default function Login() {
  const [error, action, pending] = useActionState(login, undefined)
  return (
    <main style={{ maxWidth: 360 }}>
      <h1>Setu</h1>
      <p style={{ color: '#666' }}>Sign in to continue.</p>
      <form action={action} style={{ display: 'grid', gap: '.75rem' }}>
        <label>Email<br /><input name="email" type="email" required autoFocus style={{ width: '100%', padding: '.5rem' }} /></label>
        <label>Password<br /><input name="password" type="password" required style={{ width: '100%', padding: '.5rem' }} /></label>
        <button type="submit" disabled={pending} style={{ padding: '.6rem', cursor: 'pointer' }}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p role="alert" style={{ color: '#b00', margin: 0 }}>{error}</p>}
      </form>
    </main>
  )
}
