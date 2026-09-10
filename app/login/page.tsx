'use client'
import { useActionState } from 'react'
import { FileSearch } from 'lucide-react'
import { login } from '@/lib/auth/actions.ts'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { ThemeSwitcher } from '@/components/theme-switcher.tsx'

export default function Login() {
  const [error, action, pending] = useActionState(login, undefined)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-base-200)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
            Setu
          </CardTitle>
          <CardDescription>Sign in to review a draft SRS.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              Email
              <Input name="email" type="email" required autoFocus autoComplete="username"
                     placeholder="ba@bracits.com" />
            </label>
            <label className="grid gap-1.5 text-sm">
              Password
              <Input name="password" type="password" required autoComplete="current-password" />
            </label>
            <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
            {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
          </form>
        </CardContent>
      </Card>
      <ThemeSwitcher />
    </div>
  )
}
