# 04 — Sign in, roles, and the audit log

**What to build:** People sign in and land on the page their role cares about. Everyone can read everything; only three things gate — dismissing a finding, approving the requirements document, and exporting or pushing. Every action that changes something is recorded with who did it and when, because the audit trail is a headline feature and retrofitting it later means the early records simply do not exist.

**Blocked by:** 01

**Status:** done

- [x] Seeded users exist for each role, created by a script rather than a signup flow
- [x] Passwords are hashed with a modern algorithm; sessions are httpOnly and encrypted
- [x] Signing in redirects to the landing page for that role
- [x] The three gated actions refuse users without the right role, with a clear message
- [x] Every mutation writes an audit record naming actor, action, and before/after state
- [x] Audit records are append-only — nothing in the app updates or deletes one

---

## Verified

Five seeded users, argon2 hashes, iron-session encrypted httpOnly cookie.

```
rendered gates per role (through the real HTTP boundary):
  ba          allow=[dismiss approve:srs approve:backlog export push]
  superadmin  allow=[dismiss approve:srs approve:backlog export push]
  pm          allow=[export push]   deny=[dismiss approve:srs approve:backlog]
  dev         deny=[all five]
  qa          deny=[all five]

cookie sealed with the wrong secret -> 307 /login
unauthenticated / and /runs      -> 307 /login
wrong password                    -> rejected, no session issued
```

Audit rows carry actor, action, entity and before/after JSON. No `UPDATE` or `DELETE` against
`audit_log` exists anywhere in the codebase — append-only is a property of the code, not a promise.
5/5 role unit tests green.

**Note on testing approach:** driving Next's server-action protocol over raw HTTP proved brittle and
tested the framework rather than the product. Credential verification is tested at the layer that
decides, and RBAC is tested through the real HTTP boundary with a genuinely sealed session cookie.
