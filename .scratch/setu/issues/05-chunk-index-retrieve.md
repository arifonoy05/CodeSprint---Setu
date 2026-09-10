# 05 — Index the system and retrieve evidence

**What to build:** The system corpus becomes searchable evidence. Source, schema and RCA tickets are split so that each piece is a thing a person can be pointed at — one table, one function, one ticket — because the split *is* what a citation will name later. Then, given a requirement, the right slices of the system come back. This is the first proof the retrieval half works, before any reasoning is layered on top.

**Blocked by:** 01, 02

**Status:** done

- [x] Indexing splits schema per table, source per function, and keeps each RCA whole
- [x] Every chunk carries a stable identifier and a human-meaningful source reference
- [x] Chunks are embedded and stored with a vector index
- [x] Retrieval accepts a requirement and returns ranked evidence with identifiers and references
- [x] Retrieval can be restricted by evidence kind, so different checks can ask different questions
- [x] Re-running indexing is idempotent — it does not duplicate chunks

---

## Verified

30 chunks indexed in 0.8s — 15 code, 6 ddl, 9 rca. Re-running is idempotent (upsert by id).

```
retrieval@k against the answer key
  failure_path    8/8   1.00
  contradiction   7/7   1.00
  dependency      5/7   0.71
  OVERALL        20/22  0.91
```

### Two bugs found by measuring, neither guessable

**Embedding width.** The OpenAI SDK requests base64 by default; decoding LM Studio's response that
way yields **192-dim vectors instead of 768** — well-formed response, no error, every retrieval
silently wrong. `encoding_format: 'float'` is now pinned and guarded by an assertion plus a
regression test. The width check earned its place on its first run.

**Retrieval config.** Restricting contradiction to code and dependency to ddl+code made 2 of 22
planted gaps unreachable *by construction*. But widening the pool made it worse (0.82 → 0.73):
prose RCAs out-score source code against a prose requirement and crowd it out. Per-kind quotas
fixed both, 0.91.

### Known remaining

2 dependency misses, both the D9 vocabulary gap — the SRS says "disburse to the borrower", the code
says `postToLedger`. Not tuned further: 22 data points is too few to chase without overfitting. The
principled fix, if gap recall suffers at ticket 08, is an LLM-written summary line per chunk before
embedding.
