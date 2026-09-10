import { NextResponse } from 'next/server'
import { currentUser, type SessionUser } from './session.ts'
import { can, type GatedAction } from './roles.ts'

/**
 * Route-handler auth. Pages redirect; API routes must answer with a status.
 *
 * Kept separate from requireUser/requireCan because those call redirect(), which throws
 * a control-flow signal — catching it in a route swallows the redirect, and letting it
 * escape reports a refusal as HTTP 500. A denied action must read as denied, not broken.
 */
export async function apiUser(action?: GatedAction): Promise<SessionUser | NextResponse> {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  if (action && !can(user.role, action)) {
    return NextResponse.json(
      { error: `${user.role} is not permitted to ${action}` },
      { status: 403 },
    )
  }
  return user
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse
