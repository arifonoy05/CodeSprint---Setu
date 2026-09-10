# 14 — Push to Jira, behind a flag

**What to build:** An optional push of the approved backlog to Jira, shipped switched off. Because an untested integration is the likeliest thing to fail in front of an audience, it has a dry run that shows exactly what would be sent without needing a live instance — so the path can be demonstrated honestly either way.

**Blocked by:** 13

**Status:** done

- [x] Push is disabled by default and controlled by configuration
- [x] Dry run renders the exact payload on screen and contacts nothing
- [x] Dry run works with no Jira instance configured at all
- [x] A real push happens only when explicitly enabled and only after approval
- [x] Push results and failures are recorded in the audit trail
- [x] Only roles permitted to push can push

---

## Verified

```
RBAC        dev -> 403   qa -> 403   pm -> 200

dry run  -> HTTP 200, enabled=false, target=(not configured)
            19 issues would be created
real push with the flag off -> HTTP 409
            "Jira push is disabled. Set JIRA_PUSH_ENABLED=true."
```

The dry run works with **no Jira instance configured at all** and contacts nothing. Sample payload:

```
Story — "As a loan officer, I want to disburse an approved loan in a single transaction…"
labels: setu, run-9, req-001
source: REQ-001 → story 56 (4 tasks, 6 tests)
description:
  *Requirement:* REQ-001
  h3. Acceptance criteria
  * Given The loan request is in 'APPROVED' status …
```

Each issue carries its acceptance criteria, its development tasks with the real modules and tables
they touch, and its test scenarios — marked where one covers a gap raised in review.

## Zero egress applies to Jira as well

Approved stories carry client business logic, so the private-host assertion that guards the model
endpoint (D31) guards this one too. A push to a public Jira is refused before any request is made:

```
JIRA_BASE_URL=https://mycompany.atlassian.net
  REFUSED — JIRA_BASE_URL resolves to a public address (13.227.180.4).
```

**The message named the wrong setting.** The check was generic but its wording was hardcoded to
`LLM_BASE_URL` and "the model", so a Jira misconfiguration reported itself as a model problem —
the kind of error that costs an hour at the wrong moment. The assertion now names whichever setting
is actually at fault, with a regression test covering both.

Guards, in order: role → dry-run default → feature flag → backlog approved → private host.
