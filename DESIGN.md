# Setu — Design Decisions

Shared understanding from the grilling session. **36 decisions.**
Amended after review: D3×D8 had a blocking contradiction · D11's fixture format was wrong ·
D6/D7 changed with the runtime · D3/D6/D9/D12/D13/D15/D16 amended by D23–D33 · D31 amended by D34.
Derived from the BRD: *Setu — From SRS to Sprint-Ready Backlog* (Anindo Dey, PIN 1808, BRAC IT CodeSprint 2026).

---

## Measured facts (not assumptions)

Probed on this machine, 2026-09-10. **Runtime is LM Studio, not Ollama** — decision 7's
OpenAI-compat choice absorbed the swap with zero code impact, which is the point of it.

| Fact | Value | Consequence |
|---|---|---|
| Thinking on vs off (Ollama, `think`) | **215s vs 7s** (30×) | Thinking MUST be off. 60-call run = 3.6h vs 7min. |
| Thinking on vs off (LM Studio) | 13s vs **4s** | Same conclusion, smaller margin — LM Studio caps reasoning. |
| `reasoning_effort: "none"` | works on **both** runtimes, 0 reasoning | The portable off-switch. Use this one. |
| `chat_template_kwargs.enable_thinking` | **ignored** by LM Studio (345 chars reasoning) | Do not rely on it. |
| `/v1` + `response_format: json_schema` | honoured on both | Structured output is safe on the compat endpoint. |
| Model invents evidence IDs | cited `req-1-text`, `std-c-0412-spec` unprompted | Post-filter is load-bearing, not belt-and-braces. |
| ID format drift | `"[R-1041]"` with brackets, on **both** runtimes | Normalisation is a requirement, not a quirk. |
| LM Studio | `qwen/qwen3.5-9b` @ `127.0.0.1:1234` | Serves chat + embeddings from one endpoint. |
| Embedding model | `text-embedding-nomic-embed-text-v1.5`, **768 dims** | Already loaded. Column is `vector(768)`, not 1024. |
| Docker | daemon **up**, 29.0.1; `postgres:16/17-alpine` cached | **No pgvector image cached** — first pull needed. |
| Port 5432 | **taken by Homebrew Postgres 18.4** | Compose must map host `5433:5432`. |
| 4-wide concurrency, toy prompt | 4 parallel = 2s, same as 1 | **Misleading — ignore this row.** 50-token prompt, no schema. |
| 4-wide concurrency, realistic | 1 call **3s**; 4-wide **14s**; serial-equiv 12s | **Concurrency is NOT free.** ~17% worse than serial. |
| Full-run budget (bare probe) | 60 calls × ~3s, sequential | ~3 minutes — **optimistic** |
| Full-run budget (measured, real evidence blocks) | 16 reqs × 1 check = 99s | ~6s/call → **~6-7 min** for 4 checks |
| Runtimes | Node 24.20, Python 3.12, uv, no `gh` | — |

---

## Decisions

### 1. Corpus — authored fixtures
A synthetic pilot module, not a real repo. Removes Git-read-API, Jira-read, SSO/LDAP and
object-storage from scope entirely, runs on a laptop, and makes the eval set fall out for free
because we know where the planted gaps are.

### 2. Domain — loan disbursement, I author, you review
Credible for a banking/fintech IT house, and rich in failure paths (retry, partial disbursement,
holiday calendars, reversal) that make planted gaps realistic.

```
fixtures/loan_disbursement/
  src/       disbursement_service.ts, repayment_schedule.ts, eligibility_rules.ts
             ^ TypeScript (D29): one parser, one toolchain
  schema.ddl loan, loan_schedule, disbursement_txn, borrower
  rca/       RCA-1041 double-disbursement on retry
             RCA-1047 schedule skips public holiday
             RCA-1052 reversal leaves orphan txn
  srs_draft.docx            prose, NOT pre-numbered
  ground_truth.yaml         expected segmentation + gap class + evidence
  requirements.frozen.json  committed output of one good segmentation run
```

### 3. Grounding — closed-set IDs + hard post-filter
Every chunk has a stable ID — **including extracted requirement statements themselves**, so the
missing-AC check has something legitimate to cite and the filter needs no special case. Prompt shows
only retrieved chunks, labelled. Structured output requires `evidence_ids[]`. Code drops any finding citing an ID not in *that request's* retrieved
set. **The guarantee is a property of the code, not the model's good behaviour** — it survives a
model swap, and it's demonstrable to a judge. Suppressed findings are logged (that log is also the
precision-tuning signal), and the suppression rate is reported (D19).

**Requirement chunks are run-scoped** (D23) — retrieval must never reach another document's
requirements. IDs are normalised on both sides before the subset check (D17).

> **Resolved contradiction (D3 × D8).** The filter is `evidence_ids && evidence_ids ⊆ retrieved`.
> Missing-AC retrieves nothing from the KB, so `retrieved` was empty and *every* missing-AC finding
> would have been suppressed silently — one of the four gap classes producing zero output, with its
> recall pinned at 0 by D12's match rule. Fix: requirements are indexed as `kind=requirement` chunks.
> One filter, four checks.
>
> Stated openly: the BRD says citations point at "a real file, table or ticket". A requirement ID is
> none of those. This interprets that criterion rather than meeting it literally — say so to judges
> rather than let them find it.

### 4. Stack — Next.js 15 fullstack + separate worker
Server hosts Java/JS; Python unverified — deployment constraint outranks library preference.
Route handlers are the backend, RSC + shadcn/ui the frontend. No CORS, no API contract.
*(The Node document-ecosystem objection doesn't survive contact: `mammoth`, `unpdf`, `docx`,
`exceljs` are all solid.)*

### 5. Queue — pg-boss
Postgres-backed. No second datastore, nothing extra for IT security to approve. Retries,
concurrency limits and dead-letter for free — exactly the fiddly part. Note: indexing 20 fixture
files takes seconds; what actually needs backgrounding is the **analysis run**.

### 6. Vector store — pgvector, `vector(768)`
One datastore for app data, queue and vectors. Evidence chunks live in the same transaction as the
findings citing them, so **citation integrity is a foreign key**, not a cross-service lookup.
Dimension is **768** (nomic-embed-text-v1.5, already loaded in LM Studio). Image:
`pgvector/pgvector:pg17`, mapped to host port **5433** because Homebrew Postgres holds 5432.

```sql
chunks(id text PRIMARY KEY,
       kind text,             -- requirement | code | ddl | rca
       run_id bigint NULL,    -- D23: set for requirements, NULL for KB
       source_ref text,
       text text,
       embedding vector(768))
```

### 7. LLM client — OpenAI-compatible `/v1`, base URL in env
App runs on the server, model on a separate GPU box.

```
# local dev (LM Studio on the Mac, app in a container):
LLM_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=qwen/qwen3.5-9b
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5   # 768d
LLM_REASONING_EFFORT=none                          # 30x. non-negotiable.

# server: point at the GPU box. That is the entire migration.
LLM_BASE_URL=http://gpu-box:1234/v1     # or vLLM :8000/v1
```
Zero-egress stays provable because the base URL is internal and auditable in one place.

### 8. Gap checks — 4 focused calls, each with its own retrieval query
The checks need different evidence; one generic retrieval serves none of them well.

Retrieval is a **quota per evidence kind**, not one ranked list across kinds:

| check | quotas |
|---|---|
| missing acceptance criteria | requirement 4 |
| unspecified failure paths | rca 5 |
| contradiction | code 5 + rca 3 |
| hidden dependency | ddl 3 + code 3 + rca 2 |

**Measured on the answer key**, and the middle row is the one worth remembering:

| retrieval config | overall | contradiction | dependency |
|---|---|---|---|
| narrow kinds, one ranked list | 0.82 | 0.71 | 0.71 |
| widened to include rca, one ranked list | **0.73** | 0.57 | 0.57 |
| per-kind quotas | **0.91** | 1.00 | 0.71 |

Two findings, neither guessable:
1. Restricting contradiction to code and dependency to ddl+code made 2 of 22 planted gaps
   **unreachable by construction** — an RCA describing how the system behaves today is exactly what
   a contradiction check needs.
2. Simply widening the pool made things *worse*. RCAs are prose and out-score source code against a
   prose requirement, crowding code out of the top k. This is the D9 vocabulary gap, and it means
   evidence kinds must not compete in one ranking.

Separate calls also make each check **independently tunable** — a bad precision number points at
which check caused it.

**Execute the checks sequentially, not concurrently.** Measured: one realistic call (full evidence
context + json_schema) is 3s; 4-wide is 14s against a 12s serial equivalent — LM Studio serialises
under real prefill load and the fan-out adds ~17% overhead. A first toy-prompt measurement suggested
concurrency was free; it used a 50-token prompt with no schema and did not survive a realistic
retest. So the whole 60-call run is **~3 minutes sequential**, and the concurrency machinery is code
that would make it slower.

`ponytail:` sequential execution, ~3min/run. Revisit only if the GPU box (vLLM, real batching)
measurably beats serial on the same realistic prompt — LM Studio's max-parallel setting is the knob
to test first.

### 9. Chunking — structure-aware per source type
The chunk boundary *is* the citation granularity. DDL splits per `CREATE TABLE`, code per
function, RCA kept whole. So `table loan_schedule` falls out for free rather than being inferred.

```
kind         id            source_ref
requirement  REQ-007       REQ-007
ddl          T-loan_sched  table loan_schedule
code         C-0412        disbursement_service.ts:40-72
rca          R-1047        RCA-1047
```
Splitter is a **regex**, not a parser: `^(export )?(async )?function|^class` for code, `CREATE TABLE`
for DDL. We author the fixtures, so we control the formatting.
`ponytail:` regex splitter — swap for ts-morph only if real repositories land.

**Known risk:** SRS prose says "partial disbursement", code says `handleSplitTranche()`. If recall
comes in low, adding an LLM-written summary line per chunk before embedding is the first fix.

### 10. Roles — role-flavored views, thin RBAC on 3 actions
Internal tool; no confidentiality boundary between a BA and a QA. Roles select which artifact you
land on. Only three actions gate:

```
read:            everyone
dismiss finding: ba, superadmin
APPROVE SRS:     ba, superadmin     <- the human gate
export / push:   ba, pm, superadmin
```

### 11. Eval integrity — freeze the requirement set, split the eval
`req_id` is assigned by the LLM at extraction time, so ground truth keyed by it silently
decorrelates when extraction drifts — and the eval still prints a number. So: gap eval runs against
a **committed frozen requirement set**; extraction is scored separately.

The fixture SRS is **realistic prose, not pre-numbered** — some paragraphs carry two or three
requirements, some are vague, a business rule is buried mid-sentence. Expected segmentation into
`REQ-001..016` lives only in `ground_truth.yaml`. If the docx were pre-numbered, extraction would be
a regex, `eval:extraction` would trivially score 1.00, and the BRD's AI point #1 ("an LLM segments
SRS prose into atomic, testable requirement statements") would never be exercised or demonstrable.

```
npm run eval:extraction   # segmentation P/R + classification, vs the answer key
npm run eval:gaps         # gap quality, against the frozen requirement set
```

**The frozen set is `ground_truth.yaml`'s own `requirements` list — not a captured LLM run.**
An earlier version froze one good extraction into `requirements.frozen.json`. That cannot work, and
it took building it to see why: gap entries are keyed to the answer key's `REQ-007`, but a captured
run renumbers and rephrases, so its `REQ-007` is a different requirement. Every gap key would point
at the wrong requirement and the eval would still print a confident number.

So the answer key's requirements *are* the frozen set. One file, no freeze command, no way for the
two to drift. Measured extraction variance across four runs — 15, 16, 17 and 20 requirements,
recall 0.94–1.00 — is exactly the drift this removes from the gap numbers.

The eval indexes that frozen set as `kind=requirement` chunks, never a live extraction.

### 12. Match rule — automated recall, BA-judged precision
Recall is automatable because we planted the gaps: strict match = same req + same class + ≥1
overlapping `evidence_id`. Precision genuinely needs a BA, because an *unplanted* finding may still
be valid and worth asking the client — no fixture can know that. Unplanted findings are counted and
surfaced, never scored as false positives.

- CI, every change: strict recall (headline) + loose recall (diagnostic)
- BA review sessions: the ≥70% precision number reported to judges

Precision is computed from **`ba_verdict`**, never from workflow status — see D24, which exists
because those two are not the same question.

**Retrieval recall@k — free diagnostic, reported PER CHECK.** Ground truth already stores expected
`evidence_ids` per planted gap, so for each one we can check: did the correct chunk land in the k
retrieved for that check? Without it a low gap-recall number is unattributable — retriever missed
the evidence, or reasoner had it and failed. Given the vocab-gap risk in D9, retrieval is the
likelier culprit, and this is the number that says whether to reach for the chunk-summary fix.

**Must be per-check, never aggregated.** `missing_ac` retrieves the requirement chunk that D3 makes
its own evidence, so its expected evidence is present *by construction* and it scores 1.0 always.
Aggregating would let two free 1.0s mask a genuinely weak retriever on `contradiction` and
`dependency` — the two checks that actually do the hard retrieval.

```
check          strict-R  retrieval@k
missing_ac         0.75     1.00  <- degenerate by construction, ignore
failure_paths      0.80     0.90
contradiction      0.50     0.55  <- retriever is the problem, not the reasoner
dependency         0.40     0.95  <- reasoner is the problem, not the retriever
---
strict recall      0.61  ✓ (headline)
loose  recall      0.73
unplanted findings   14   <- counted, never scored FP
```

### 13. Phase 2 — all four artifacts
Stories + Given/When/Then AC (BA) · task breakdown naming modules and tables (Dev) · test scenarios
seeded from Phase 1 findings (QA) · requirement→story→test matrix (PMO).
The matrix needs stories and tests, so those three are a package. Dev tasks are one more prompt of
the same shape and are the most demo-impressive artifact — they reuse Phase 1's retrieved evidence.

**Traceability links are structural, not semantic** (D30). Stories and tests are *generated from*
requirements, so the link is known at generation time. No LLM call.

### 14. Auth + audit — iron-session + immutable `ai_original`
argon2 hashes, users seeded by script, encrypted httpOnly cookie.
The BRD wants "what the AI proposed, what the human changed, who approved it, when" — so the AI's
original text is written once and never updated. **The diff is the audit record.**

```sql
findings(ai_original text NOT NULL,   -- never UPDATEd
         edited_text text,
         status proposed|accepted|edited|dismissed,
         decided_by, decided_at)
audit_log(actor, action, entity, before, after, at)   -- append only
```

**The same three columns go on every AI-proposed artifact, not just findings.** D13 ships stories,
tasks, test scenarios and matrix rows, and the BRD says "every artifact is reviewed in-app and
approved by a person". If only `findings` carries `ai_original`, the audit trail stops at the
sign-off gate and covers none of the backlog — which is half of what the tool produces.

```
stories | tasks | test_scenarios | trace_links
  ai_original text NOT NULL,   -- never UPDATEd
  edited_text text,
  status, decided_by, decided_at
```
Shared shape, one helper, four tables.

### 15. Export — XLSX + DOCX, Jira push behind a flag
`exceljs` → one workbook, sheets: Stories | Tasks | Tests | Traceability.
`docx` → client question sheet, the artifact the BA physically carries into the meeting.
Jira push ships behind a feature flag **with a dry-run mode** that renders the exact payload to
screen — so the code path is exercisable on stage without a live instance.

**Export is blocked below 100% traceability coverage** (D28), naming the unmapped requirements.

### 16. Run — Docker Compose
`postgres+pgvector`, app, worker. **The LLM stays outside compose** — it's on a separate box.
Locally `LLM_BASE_URL=http://host.docker.internal:1234/v1` (LM Studio); on the server, the real GPU
hostname. `localhost` inside a container is the container.

**The app service runs with no external network** (D31). Only the LLM host is reachable, and that is
asserted at startup.

### 17. Evidence ID normalisation — in the parser, treated as adversarial input
Confirmed on both Ollama and LM Studio, so this is a requirement, not a quirk. Normalise **both
sides** before the subset check.

```
norm(id) = id.replace(/[\[\]`\s]/g,'').toUpperCase()
           .replace(/^RCA-/,'R-')

valid = f.evidence_ids.length > 0 &&
        f.evidence_ids.map(norm).every(id => retrievedNorm.has(id))
```
Anything still unmatched is logged **with the raw string**. That log distinguishes a format quirk
from a genuine hallucination — and those need different fixes.

**That log paid for itself on the first real run.** 5 of 6 suppressions were the model echoing back
the whole rendered evidence line — `"[R-1092] (RCA-1092)"` — because the prompt shows evidence as
`[ID] (sourceRef)`. Stripping brackets alone left the trailing `(RCA-1092)`, so valid findings were
discarded as ungrounded. Taking the bracketed id, else the leading token, moved suppression from
**19% to 3%** and raised findings shown to the BA from 25 to 32. Without the raw string this would
have read as "the model hallucinates citations" and been mis-fixed by loosening the filter.

### 18. Eval set size — plant ~30 gaps, not ~10
With ~10 planted gaps, recall moves in 10-point jumps and a single finding flips 60% → 70%. You
would be tuning against noise, unable to tell a real improvement from a re-roll. **~30 gaps across
16 requirements (~2 each, spread over all four classes)** costs the same authoring effort and gives
~3-point resolution.

**Measured caveat:** even at 30 gaps, run-to-run variance is larger than this predicted —
`missing_ac` moved 0.88 to 0.75 between two runs with no relevant change. The estimate ignored the
model's own stochasticity. Do not trust a single run to better than ~0.10.

Distribution target, so no class is starved:
```
missing_ac      ~8      contradiction   ~7
failure_paths   ~8      dependency      ~7
```

### 19. Suppression rate is a reported metric
~35 chunks retrieving k=6 means ~17% of the corpus is "retrieved" on every check, so a hallucinated
ID has a real chance of landing in-set by accident. The mechanism is correct and scales correctly —
but it is **not proven at fixture scale**, and we should not claim it is.

So report `suppressed / produced` on every run. A non-zero suppression rate is *evidence the filter
does work*, which is a stronger demo line than asserting the guarantee. State the small-corpus
caveat openly rather than letting a judge find it.

### 20. Deduplicate findings across checks
"No idempotency on retry" is legitimately both a *failure path* and a *contradiction*. Four checks
will surface the same gap more than once, and a BA reading near-duplicates concludes the tool is
noisy — **precision damage that the automated recall metric never sees.**

Dedup after the filter, before the BA sees anything. Grouping is **union-find over shared evidence
within one requirement** — one merged finding per connected component. Plain "group by overlap" is
undefined, because overlap is not transitive: A∩B≠∅ and B∩C≠∅ does not imply A∩C≠∅.

Survivor takes the highest severity and the union of gap classes. **Losing rows are kept**, not
deleted, with `merged_into_id` pointing at the survivor — their `ai_original` and `question` are AI
proposals too, and D14 makes those immutable. The BA view filters `merged_into_id IS NULL`.

### 21. Severity rubric — three levels, anchored to consequence
The probe returned "High" and "Critical" for the same gap on two runs. Uncalibrated severity is
noise that costs BA trust. Constrain the enum to `high | medium | low` (drop "critical") and put the
rubric in the prompt:

```
high    money movement or data loss can occur
medium  system behaves incorrectly, no data/money at risk
low     requirement is unclear or ambiguous only
```

### 22. Stored fallback run for the demo
A local 9B will return zero findings once, and it will be on stage. Keep one approved run seeded in
the database behind `?demo=stored`. Say so if asked — it is the difference between a bad minute and
a dead demo.

### 23. Requirement chunks are run-scoped
`chunks` holds two lifetimes: code/DDL/RCA are corpus-scoped and permanent, extracted requirements
(D3) are per-run. Unscoped, document B's check can retrieve and cite document A's requirements —
passing the filter cleanly, because the ID *is* real. A grounded-looking finding pointing at the
wrong document is worse than an uncited one.

```sql
run_id bigint NULL          -- set on requirement chunks, NULL on KB chunks
-- every retrieval:
WHERE run_id IS NULL OR run_id = :current_run
```
The eval path indexes the **frozen** set under a fixed run id, never a live extraction (D11).

### 24. Workflow status and BA verdict are different columns
D12 reports precision from BA judgement, but a workflow status cannot express it: **dismissed ≠
invalid.** A BA dismisses findings that are perfectly valid — already known, out of scope, accepted
risk. Deriving precision from `status` would silently understate it, and that is the number reported
to judges.

```sql
status     proposed | accepted | edited | dismissed   -- what the BA DID
ba_verdict valid | invalid | NULL                     -- was it worth asking?
```
The review UI asks once, separately: *"worth asking the client?"* Precision = `valid / (valid +
invalid)`, ignoring NULL. Unplanted-but-valid findings score correctly, which is the whole point of
D12.

### 25. Requirement classification
BRD AI point 1 requires each requirement classified as **functional | non-functional | business_rule
| constraint**. It was missing entirely. Free to add — same extraction call, one enum field on the
output schema, one column. Also earns its keep: it lets the gap prompts differ slightly by type (a
non-functional requirement needs measurable thresholds, not Given/When/Then).

### 26. No document versioning — revisions are captured per finding
The BRD's human gate says the SRS *is revised* before approval, so Phase 2's "approved requirement
set" could differ from what Phase 1 analysed. Modelling that as document versions means re-upload,
re-extract, re-index, re-map every finding, and traceability across versions.

Instead: the BA **edits the requirement text in place** and records a `resolution_note` on each
finding (what the client said). Approval snapshots the requirement set into the run. One document,
one timeline, traceability intact.
`ponytail:` single-document model. Real multi-round client cycles need versioning; the demo does not.

### 27. Time-to-backlog instrumentation
Success criterion: stories, criteria and scenarios **approved** in under 30 minutes. Nothing
measured it.

**Measure the right interval.** `approved_at` is the *SRS* gate, which fires before generation — so
`approved_at − started_at` stops before a backlog exists and would display a number structurally too
small. The figure is `backlog_approved_at − started_at`.

**Label it honestly:** elapsed wall clock, including the ~3-minute analysis run and any time the BA
walked away. Not "BA time". A measured-looking number that measures something adjacent to the claim
is the same failure as the toy-prompt concurrency test.

### 28. Traceability coverage is asserted, not assumed
Success criterion is **100% of approved requirements mapped to ≥1 story and ≥1 test**. D13 generated
the matrix but nothing ever checked it. Compute coverage on the matrix view; **block export below
100%** and name the unmapped requirements. A criterion that is never asserted is a criterion you
will discover you failed on stage.

### 29. Fixture source language — TypeScript
The doc previously said `.ts` in one place and mentioned Java in another. TypeScript: one parser,
one toolchain, same language as the chunker. A judge will not care what language a fixture module is
written in.

### 30. Traceability links are structural — delete the semantic matching
BRD AI point 5 proposes semantic req↔story↔test matching. But stories and tests are **generated
from** requirements, so the link is known by construction. Semantic matching would re-derive a fact
we already hold, more slowly and less reliably.

Record `trace_links(requirement_id, story_id, test_id)` at generation time. **One fewer LLM call, one
fewer failure mode.** Semantic matching becomes necessary only if external stories or tests are ever
imported — say that plainly rather than implementing it now.

### 31. Zero egress: asserted at the endpoint, acknowledged when public
> **Amended by D36.** The endpoint now lives in the database, set through Settings, so a
> boot-time check on an environment variable would test the wrong value — and would make the
> app unstartable precisely when someone needs to open Settings to fix it. The check moved to
> the connection test, and a public endpoint is possible but requires an explicit
> acknowledgement. Original reasoning below.


Success criterion says *"demonstrable in network logs"*. D7 only made the URL auditable. Add a
startup assertion that `LLM_BASE_URL` resolves to RFC1918 or loopback, and run the app service on a
compose network with no external route. The process **refuses to boot** against a public host.

That is a demo artifact: show the assertion, change the env to a public URL, watch it fail.

**This constrains the demo topology — see D34.** App on a remote server + model on a laptop means
the model must be reachable privately, or this assertion (correctly) refuses to boot.

### 32. SRS text extraction — whole document, one call
`mammoth` for DOCX, `unpdf` for PDF, then the full text into one extraction call. The fixture is
~16 requirements and fits comfortably.
`ponytail:` whole-document extraction. A real 50-page SRS needs section-wise extraction with
overlap; add it when a real SRS arrives, not before.

### 33. One unit test on the money path
The eval harness cannot distinguish a filter bug from a model miss — it only sees the end result. So
`test_pipeline.ts` asserts the deterministic logic against fixed inputs: normalisation (`"[R-1041]"`
→ `R-1041`), the closed-set filter (out-of-set ID dropped, empty evidence dropped), dedup (D20), and
run scoping (D23). No framework, `node --test`.

This is the one place a silent bug would corrupt every number the project reports.

### 34. Demo topology — app remote, model local, joined by a reverse tunnel
The app is hosted on a remote server; the model runs in LM Studio on the Mac. D7 already makes the
endpoint a config value, so either "model on the hosted server" or "model on an external server"
works with no code change — that was the point of D7.

But it collides with D31: exposing the Mac on a public address both fails the startup assertion and
**genuinely is egress** — SRS text would cross the public internet, which is the one thing the BRD
forbids. So do not expose it.

**SSH reverse tunnel.** The Mac dials out to the server; nothing on the Mac is publicly listening.

```
# from the Mac:
ssh -R 0.0.0.0:1234:localhost:1234 user@server     # needs GatewayPorts clientspecified

# compose, on the server:
extra_hosts: ["host.docker.internal:host-gateway"]
LLM_BASE_URL=http://host.docker.internal:1234/v1   # -> 172.17.0.1, RFC1918, D31 passes
```

**The gotcha that eats a demo morning:** `ssh -R` binds to the server's `127.0.0.1` by default, which
a container cannot reach. It must bind where the Docker bridge can see it — hence `0.0.0.0` plus
`GatewayPorts`, or bind the bridge IP directly. Verify from *inside* the container, not from the
server shell:
`docker compose exec app curl -s http://host.docker.internal:1234/v1/models`

Tailscale is the alternative; add `100.64.0.0/10` to D31's allowlist if used, since CGNAT space is
not RFC1918.

**Consequences already handled:** the tunnel can drop or the Mac can sleep mid-run — pg-boss retries
cover it (D5). Added latency is a network round-trip per call, negligible against ~3s of inference.

**Concurrency (open item) is now conditional.** The demo model is LM Studio on this Mac, which was
measured and serialises — so sequential execution (D8) is settled for the demo. Re-measure only if
the model later moves onto the hosted server behind vLLM.

### 35. Fixture assumptions are explicit and individually revisable
A BA — not us — decides whether the loan-disbursement domain is right. So the fixtures must be
cheap for them to check and cheap for us to correct, and neither can block authoring.

Every domain assumption is written down, and **every planted gap names the assumption it rests on**:

```yaml
# fixtures/ASSUMPTIONS.md   <- the BA reads this, ~5 minutes
A1  reversal/write-off is finance-side, not disbursement-side
A2  holiday calendar is consulted in schedule generation
A3  RCA ids look like RCA-1041; root cause stated, not just symptom

# ground_truth.yaml
- req: REQ-007
  gap: dependency
  evidence: [R-1052]
  assumes: A1        # <- flip A1 and only these entries change
```

If the BA overturns A1, the blast radius is a grep, not a rewrite. Without this, one wrong domain
assumption silently invalidates the ground truth that every quality number depends on.
`ponytail:` assumption tags cost one YAML key and make a BA's correction a localised edit.

### 36. The model endpoint is configured in the app, not the environment
Changing the endpoint meant editing `.env` and redeploying both services, and nothing verified it
until an analysis failed halfway through. It now lives in `model_config`, set by a superadmin at
**Settings → Model**: URL, optional API key, chat and embedding model, reasoning effort.

**Nothing runs until a connection test passes.** The test checks what Setu actually depends on
rather than that the endpoint answers — `json_schema` compliance, whether `reasoning_effort` is
honoured, and embedding width against the `vector(768)` the schema stores. Each of those otherwise
surfaces minutes into a run. `verified_at` is set only by a passing test, and both the upload
endpoint and backlog generation refuse while a blocker stands; the UI hiding the control is
presentation, not the control.

**API keys are encrypted at rest** (AES-256-GCM, key derived from `SESSION_SECRET`) and never sent
back to the browser — the form shows a masked hint and an empty field means "keep the stored key".

**This supersedes part of D31, and weakens the BRD's central promise.** The BRD says all inference
runs on internally hosted models and client business logic never leaves the network. Pointing Setu
at a hosted provider breaks that. It is now possible, but never silently: the test resolves the
endpoint, and a public one cannot be saved as verified until someone ticks a box stating that
requirement text, source code and incident history will leave the network. The choice is recorded
in `audit_log` and shown on the health page.
`ponytail:` one active configuration. Per-environment or per-run endpoints are a table with more
rows, not a redesign.

---

## Build order

1. **Fixtures** — pilot module (TypeScript, D29), DDL, RCAs, prose SRS. Carries D18 (~30 gaps),
   D21 (severity anchors) and D35 (assumption tags) baked in — all three are expensive to retrofit.
   **Does not block on the BA review**; assumption tags make their corrections localised.
2. **Eval harness** — `eval:extraction`, `eval:gaps`, per-check `retrieval@k` (D12), suppression
   rate (D19). Nothing downstream is measurable until this exists.
3. **Index + retrieve** — chunking (D9), pgvector, requirement chunks (D3), run scoping (D23).
   Schema lands here, so D23/D24/D25 must be settled first — they are.
4. **Gap pipeline** — 4 checks run **sequentially** (D8), normalise (D17), filter (D3), dedup (D20),
   plus `test_pipeline.ts` (D33) alongside.
5. **Review UI + approval gate** — findings, audit columns (D14), `ba_verdict` (D24),
   resolution notes (D26), elapsed timer (D27).
6. **Phase 2 generation + matrix + export** — structural links (D30), coverage gate (D28), D13/D15.
7. **Stored demo run** (D22).

---

## Open items

- [x] ~~Start Docker Desktop~~ — running, 29.0.1
- [x] ~~Pull an embedding model~~ — nomic-embed-text-v1.5 already loaded, 768d
- [x] ~~Confirm 4-wide concurrency~~ — measured: NOT free, serial is faster. Run sequentially.
- [ ] Re-measure 4-wide **only if** the model moves onto the hosted server behind vLLM (D34).
      Settled for the demo: LM Studio serialises, run sequentially.
- [ ] Verify the reverse tunnel from *inside* the container, not the server shell (D34)
- [x] ~~Normalise evidence IDs~~ — now decision 17
- [ ] **Domain review — a BA decides** (D35). Fixtures get authored first with assumptions A1–A3
      written down; the BA reads one page and confirms or overturns each. Not a blocker.
      A scrubbed real RCA would settle A3 outright.

## Demo target

One anonymised SRS, one indexed module, end to end:
**gap report → BA review → approval gate → backlog + traceability matrix → export.**
