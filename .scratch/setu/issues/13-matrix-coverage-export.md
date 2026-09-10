# 13 — Traceability matrix, coverage, and export

**What to build:** The delivery lead's view — every approved requirement traced to its stories and tests, with coverage stated plainly. Below full coverage, export is refused and the unmapped requirements are named, because a target that is never checked is one you discover you missed on stage. What does export is a spreadsheet a delivery lead can open immediately, and the client question sheet a business analyst carries into the meeting.

**Blocked by:** 12

**Status:** done

- [x] Matrix shows requirement to story to test, with coverage as a percentage
- [x] Requirements missing a story or a test are named, not just counted
- [x] Export is refused below full coverage, explaining exactly what is missing
- [x] Spreadsheet export carries stories, tasks, tests and the matrix on separate sheets
- [x] Question sheet exports as a document listing open gaps with their evidence
- [x] Only roles permitted to export can export

---

## Verified

```
coverage 100% — 18/18 requirements have a story and a test

RBAC        dev -> 403      pm -> 200
at 100%     xlsx -> 200, 42,852 bytes    docx -> 200, 17,890 bytes
```

**XLSX** opens with four sheets and real rows: Stories 20 · Tasks 92 · Tests 176 · Traceability 176.
Task rows carry real system names (`disbursement_service`, `loan, disbursement_txn,
holiday_calendar, loan_schedule`).

**DOCX** question sheet: 31,764 characters, 61 open questions grouped by requirement, each with
severity, why it is being asked, the evidence it came from, and a blank line for the client's answer.

## The gate was tested by breaking it

An unexercised gate is decoration, so every story on one requirement was dismissed:

```
coverage now 94% — unmapped: REQ-018 (no story)
xlsx -> HTTP 409
  {"error":"Traceability coverage is below 100%.","coverage":"17/18",
   "unmapped":[{"ref":"REQ-018","missing":"no story"}]}
docx -> HTTP 200   (question sheet is pre-sign-off, deliberately not gated)
restored — coverage 100%
```

The refusal names the requirement and what it is missing, rather than only reporting a percentage —
a percentage tells you that you failed, not what to fix.

**Coverage excludes dismissed artifacts.** A story the BA dropped covers nothing, so counting it
would let the criterion pass while the requirement is genuinely unmapped.
