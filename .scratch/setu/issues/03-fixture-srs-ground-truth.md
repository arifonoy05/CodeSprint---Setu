# 03 — Fixture SRS and ground truth

**What to build:** The draft requirements document Setu will be judged on, written as realistic prose — some paragraphs carrying two or three requirements, some vague, a business rule buried mid-sentence. Never pre-numbered, or requirement extraction becomes a regex and proves nothing. Alongside it, the answer key: roughly thirty gaps deliberately planted across all four gap classes, each naming the evidence that reveals it and the domain assumption it rests on.

**Blocked by:** 02 — planted gaps must cite evidence that exists.

**Status:** done

- [x] Requirements document reads as prose; no requirement numbering anywhere in it
- [x] Expected segmentation into ~16 requirements lives only in the answer key
- [x] ~30 planted gaps, spread so no gap class has fewer than six
- [x] Every planted gap names the evidence that reveals it and the assumption it depends on
- [x] A validator fails loudly if any gap cites evidence that does not exist
- [x] Overturning a single assumption changes only the entries tagged with it

---

## Delivered

`fixtures/srs_draft.md` (editable source) → `srs_draft.docx` (what a BA uploads, 48 paragraphs,
3,022 extractable characters, **zero requirement numbers**).
`fixtures/ground_truth.yaml` — 16 expected requirements with classifications, 30 planted gaps.
`eval/validate-fixtures.ts` — run with `npm run fixtures:check`.

```
corpus       30 chunks       missing_ac      8
requirements 16              failure_path    8
gaps         30              contradiction   7
                             dependency      7

blast radius if a BA overturns an assumption:
  A1 4 · A2 7 · A3 0 · A4 7 · A5 6 · A6 6
```

Validator proven to fail on all six ways it matters: a citation to a non-existent RCA, a misspelled
table name, an assumption absent from ASSUMPTIONS.md, a pre-numbered SRS, a gap class dropping below
six, and a contradiction citing only requirements instead of the system.

**Change from SPEC §5.2:** chunk IDs are derived (`C-disbursement_service.disburse`), not opaque
counters (`C-0412`). The answer key must cite evidence before indexing exists, so a serial number is
unauthorable — and a derived id reads as a place in a citation shown to a BA. SPEC updated.

**Prefactor for ticket 05:** ID derivation and chunking live in `lib/rag/ids.ts`, already used by the
validator. The indexer consumes the same module, so the closed set the validator checks against and
the closed set findings are filtered against cannot drift apart.
