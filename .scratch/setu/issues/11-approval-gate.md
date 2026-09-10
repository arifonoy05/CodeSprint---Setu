# 11 — The approval gate

**What to build:** The single human decision the whole design turns on. Once every finding has been dealt with, a business analyst approves the requirements — and only then does anything get generated. Approval fixes the requirement set as it stands, so what the backlog is built from is exactly what was signed off.

**Blocked by:** 10

**Status:** done

- [x] Approval is unavailable until every finding has been accepted, edited or dismissed
- [x] Approval requires an explicit confirmation, not a stray click
- [x] Approving records who approved and when
- [x] Approving fixes the requirement set for everything generated afterwards
- [x] No artifact can be generated, exported or pushed before approval
- [x] Only the roles permitted to approve can approve

---

## Verified

```
QA tries to approve:  REFUSED — qa may not approve
PM tries to approve:  REFUSED — pm may not approve
BA approves:          APPROVED
BA approves again:    REFUSED — already approved

run 9: status=approved  approved_by=Anindo Dey  timestamped=true
audit rows for this approval: 1
```

With 59 findings undecided the gate refused; at 0 undecided it allowed. Approval takes an explicit
confirmation step ("This fixes the requirement set and cannot be undone here"), not a single click.

After approval, rendered as BA:

```
approved banner      present  ✓
fixed-set notice     present  ✓
decisions locked     present  ✓
revise link gone     absent   ✓
approve button gone  absent   ✓
```

### Fixing the requirement set is enforced at the action, not the button

`assertNotApproved` runs inside `decideFinding` and `editRequirement`, so an approved run refuses
edits whether or not the UI offered them. The disabled controls are presentation; the guard is the
control. This is what makes D26 work without document versioning — the backlog is generated from
exactly the text that was signed off, because nothing can change it afterwards.

### Requirement revision in place (D26)

The BA revises requirement text directly, with "As extracted from the document" kept as a
disclosure. `ai_original` is never written, so the diff stays the audit record (D14) and no version
history subsystem is needed.
