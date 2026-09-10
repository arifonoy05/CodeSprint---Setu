# 10 — Review the findings

**What to build:** The screen the whole product exists for. Findings grouped by requirement, each showing what may be missing, how serious it is, and the question to take to the client — with citations that link to the actual evidence, so a BA can check the claim in one click. They accept, edit or dismiss each one, and separately say whether it was worth asking at all. That second answer is the precision metric, and it is not the same question as dismissing.

**Blocked by:** 09

**Status:** done

- [x] Findings are grouped by requirement, with severity and the client-facing question
- [x] Every citation links to the real evidence it names
- [x] Accept, edit and dismiss are available per finding and recorded with who and when
- [x] "Worth asking the client?" is asked separately from the accept/dismiss action
- [x] Precision is computed from that answer alone, never inferred from dismissals
- [x] What the model originally proposed remains visible after a human edits it
- [x] A note can be recorded per finding for what the client said
- [x] Header shows elapsed time and the suppression rate for the run

---

## Verified

Run header, rendered live:

```
Requirements 18 · Findings 63 · Undecided 59
Suppressed     5 (4%)   cited evidence outside what was retrieved, so never shown
Signal quality 75%      3 of 4 judged worth asking
Elapsed        61 min   wall clock since upload
```

Citations expand inline to the actual evidence — the full RCA text, table definition or function
body — so a BA checks the claim without leaving the page or trusting a link.

Review states exercised end to end:

```
#601 accepted   verdict=valid    original kept
#602 edited     verdict=valid    edited_text set, ai_original intact
#603 dismissed  verdict=valid    + note "already covered by CR-88"
#604 dismissed  verdict=invalid
```

RBAC: Dismiss is disabled for QA ("Only a BA can dismiss a finding") and enabled for BA, checked by
rendering the same page under both sessions. The server action re-checks; the disabled button is
presentation, not the control.

### D24 proved itself with real numbers

```
precision from ba_verdict  0.75   (valid 3, invalid 1)
precision from status      0.50   — wrong
```

One finding was dismissed as already covered by an existing change request, yet judged genuinely
worth asking. Had precision been derived from the workflow status — the obvious shortcut — the
headline number reported to judges would have been understated by 25 points, and nothing would have
indicated it. This is the contradiction caught at design time (C2) turning out to be real.

### D14 holds through editing

`ai_original` survives a human rewrite; the UI offers "What the AI originally proposed" as a
disclosure next to the edited text. The diff between the two columns is the audit record, and an
`audit_log` row carries before/after for every decision.
