# Setu — Build Specification

Derived from `DESIGN.md` (35 locked decisions). Where this document and `DESIGN.md` disagree,
`DESIGN.md` wins and this file is wrong — every section here cites the decisions it implements.

**Scope:** one anonymised SRS, one indexed module, end to end —
gap report → BA review → approval gate → backlog + traceability matrix → export.

---

## 1. Topology

```
  ┌─ remote server ──────────────────────────┐        ┌─ this Mac ───────┐
  │  docker compose                          │        │                  │
  │    app     Next.js 15   :3000            │        │  LM Studio :1234 │
  │    worker  pg-boss consumer              │        │   qwen/qwen3.5-9b│
  │    db      pgvector/pgvector:pg17  :5433 │        │   nomic-embed    │
  │                                          │        │                  │
  │  LLM_BASE_URL=host.docker.internal:1234 ─┼── ssh -R ─────────────────┘
  └──────────────────────────────────────────┘   (Mac dials out; nothing public)
```

App service has **no external network route** (D31). Startup asserts `LLM_BASE_URL` resolves to
RFC1918 / loopback / `100.64.0.0/10`, else the process exits non-zero. (D16, D31, D34)

Tunnel must bind where the Docker bridge can reach it, not the server's loopback:
```bash
ssh -R 0.0.0.0:1234:localhost:1234 user@server      # GatewayPorts clientspecified
docker compose exec app curl -s http://host.docker.internal:1234/v1/models   # verify HERE
```

---

## 2. Repository layout

```
setu/
  app/
    (auth)/login/
    runs/[id]/            gap report + review           D14 D24 D27
    runs/[id]/backlog/    phase 2 artifacts             D13
    runs/[id]/matrix/     traceability + coverage       D28
    api/                  see §6
  lib/
    db/schema.ts          drizzle                       §4
    db/migrate.ts
    ai/client.ts          OpenAI-compat wrapper         D7
    ai/prompts/           extract, gap.*, story, task, test
    ai/schemas.ts         json_schema definitions
    rag/chunk.ts          structure-aware splitter      D9
    rag/index.ts          embed + upsert
    rag/retrieve.ts       per-check queries             D8 D23
    pipeline/analyze.ts   4 checks, sequential          D8
    pipeline/postprocess.ts  normalise, filter, dedup   D3 D17 D20
    pipeline/generate.ts  phase 2 + trace links         D13 D30
    export/xlsx.ts        export/docx.ts  export/jira.ts
    auth/                 iron-session, argon2, rbac    D10 D14
  worker/index.ts         pg-boss consumer              D5
  fixtures/
    loan_disbursement/src/*.ts  schema.ddl  rca/*.md
    srs_draft.docx        ASSUMPTIONS.md
    ground_truth.yaml     (requirements = the frozen set)  D11 D18 D35
  eval/
    extraction.ts  gaps.ts  report.ts
  test/pipeline.test.ts   node --test                   D33
  docker-compose.yml
```

---

## 3. Pipeline

```
upload ──▶ extract ──▶ index ──▶ analyze ──▶ REVIEW ──▶ APPROVE ─┐
 docx/pdf   LLM        chunks     4 checks    human      gate    │
 mammoth/   +classify  +embed     sequential  accept/            │
 unpdf                            per req     edit/              ▼
                                              dismiss    generate ──▶ export
                                                         stories      xlsx/docx
                                                         tasks        jira(flag)
                                                         tests
                                                         trace links
```

Nothing is generated and nothing is pushed before the approval gate. (BRD §4)

**pg-boss job types** (D5): `index_kb` · `extract_requirements` · `analyze_run` · `generate_artifacts`.
All are idempotent on `run_id`; a retry after a dropped tunnel resumes rather than duplicates.

---

## 4. Data model

```sql
CREATE EXTENSION IF NOT EXISTS vector;

users(id bigserial pk, email citext unique, name text,
      role text CHECK (role IN ('superadmin','ba','dev','qa','pm')),
      password_hash text, created_at timestamptz default now());          -- D10 D14

documents(id bigserial pk, filename text, mime text, text text,
          uploaded_by bigint refs users, uploaded_at timestamptz);

runs(id bigserial pk, document_id bigint refs documents,
     status text CHECK (status IN ('extracting','indexing','analyzing',
                                   'review','approved','generating','ready','failed')),
     llm_model text, embed_model text,
     started_at timestamptz, finished_at timestamptz,
     approved_at timestamptz, approved_by bigint refs users,      -- SRS gate
     backlog_approved_at timestamptz);                            -- D27, see below

-- two lifetimes in one table; run_id is what keeps them apart            -- D23
chunks(id text pk,                          -- REQ-007 | C-0412 | T-loan | R-1041
       kind text CHECK (kind IN ('requirement','code','ddl','rca')),
       run_id bigint NULL refs runs,        -- set for requirements, NULL for KB
       source_ref text,                     -- 'table loan_schedule', 'svc.ts:40-72'
       text text,
       embedding vector(768));                                            -- D6
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks (kind, run_id);

requirements(id bigserial pk, run_id bigint refs runs,
             ref text,                      -- REQ-007
             classification text CHECK (classification IN
               ('functional','non_functional','business_rule','constraint')),  -- D25
             ai_original text NOT NULL,     -- never UPDATEd                   -- D14
             edited_text text,                                                 -- D26
             order_index int);

findings(id bigserial pk, run_id bigint refs runs,
         requirement_id bigint refs requirements,
         gap_class text CHECK (gap_class IN
           ('missing_ac','failure_path','contradiction','dependency')),
         merged_classes text[],                                            -- D20
         merged_into_id bigint refs findings NULL,   -- survivor; loser rows kept  D14
         severity text CHECK (severity IN ('high','medium','low')),        -- D21
         ai_original text NOT NULL, edited_text text, question text,
         status text CHECK (status IN ('proposed','accepted','edited','dismissed')),
         ba_verdict text CHECK (ba_verdict IN ('valid','invalid')) NULL,   -- D24
         resolution_note text,                                             -- D26
         decided_by bigint refs users, decided_at timestamptz);

-- the FK that makes citation integrity structural rather than hoped-for   -- D3 D6
finding_evidence(finding_id bigint refs findings ON DELETE CASCADE,
                 chunk_id text refs chunks ON DELETE RESTRICT,
                 PRIMARY KEY (finding_id, chunk_id));
-- RESTRICT, deliberately: requirement chunks are run-scoped (D23), so re-extracting
-- a run would otherwise orphan live citations. A citation pins its evidence; deleting
-- cited evidence must fail loudly. Re-analysis creates a new run.

suppressed(id bigserial pk, run_id bigint, requirement_id bigint, gap_class text,
           raw_evidence_ids text,          -- RAW string, pre-normalisation  -- D17
           reason text CHECK (reason IN ('no_evidence','out_of_set')),
           created_at timestamptz);                                         -- D19

stories(id bigserial pk, run_id bigint, requirement_id bigint refs requirements,
        title text, criteria jsonb,        -- [{given,when,then}]
        ai_original text NOT NULL, edited_text text,
        status text, decided_by bigint, decided_at timestamptz);            -- D13 D14

tasks(id bigserial pk, run_id bigint, story_id bigint refs stories,
      modules text[], tables text[],       -- reuses phase-1 evidence
      ai_original text NOT NULL, edited_text text,
      status text, decided_by bigint, decided_at timestamptz);

test_scenarios(id bigserial pk, run_id bigint, story_id bigint refs stories,
               kind text CHECK (kind IN ('positive','negative')),
               from_finding_id bigint refs findings NULL,   -- seeded by phase 1
               ai_original text NOT NULL, edited_text text,
               status text, decided_by bigint, decided_at timestamptz);

-- structural, recorded at generation time. no LLM, no semantic matching    -- D30
trace_links(id bigserial pk, run_id bigint,
            requirement_id bigint refs requirements,
            story_id bigint refs stories,
            test_id bigint refs test_scenarios);

audit_log(id bigserial pk, actor_id bigint refs users, action text,
          entity_type text, entity_id bigint,
          before jsonb, after jsonb, at timestamptz default now());        -- D14
```

**Invariant.** Every AI-proposed row carries `ai_original` (immutable) + `edited_text` +
`status`/`decided_by`/`decided_at`. The diff *is* the audit record. This covers `requirements`,
`findings`, `stories`, `tasks`, `test_scenarios` — not findings alone. (D14)

---

## 5. AI stages

Client: OpenAI-compatible `/v1`, `response_format: json_schema`, **`reasoning_effort: "none"`** on
every call — measured 215s → 4s, non-negotiable. (D7)

### 5.1 Extraction
Whole document text in one call (D32). Output:
```json
{"requirements":[{"ref":"REQ-001","text":"...",
  "classification":"functional|non_functional|business_rule|constraint"}]}
```
`ponytail:` whole-document extraction; section-wise with overlap when a real 50-page SRS arrives.

### 5.2 Indexing
| source | split | id | source_ref |
|---|---|---|---|
| DDL | per `CREATE TABLE` | `T-loan_schedule` | `table loan_schedule` |
| code | regex `^(export )?(async )?function\|^class` | `C-disbursement_service.disburse` | `svc.ts:40-72` |
| RCA | whole file | `R-1047` | `RCA-1047` |
| requirement | one per requirement, `run_id` set | `REQ-007` | `REQ-007` |

`ponytail:` regex splitter — ts-morph only if real repositories land. (D9)

**IDs are derived, never counters.** An earlier draft used opaque `C-0412`. That cannot work: the
fixture answer key has to cite evidence IDs *before* any indexing has run, and nobody can author a
serial number by hand. Derived IDs also read as a place rather than a number in a BA-facing
citation. Derivation lives in one module, shared by the validator and the indexer.

### 5.3 Gap checks — four calls per requirement, **sequential** (D8)

One query per kind with a quota, merged by score — not one ranked list across kinds.

| check | quotas |
|---|---|
| `missing_ac` | requirement 4 |
| `failure_path` | rca 5 |
| `contradiction` | code 5 + rca 3 |
| `dependency` | ddl 3 + code 3 + rca 2 |

Measured retrieval@k on the answer key: one ranked list 0.82 → widened 0.73 → quotas **0.91**.
Config is single-sourced in `lib/rag/checks.ts` so the evaluator and the pipeline cannot disagree
about what a check can see.

Every retrieval also applies `run_id IS NULL OR run_id = :run` (D23).
Query vector = embedding of the requirement text.

Prompt shows only the retrieved chunks, each labelled with its ID, and states: *cite only these IDs*.

Severity rubric goes in every gap prompt verbatim (D21):
```
high    money movement or data loss can occur
medium  system behaves incorrectly, no data/money at risk
low     requirement is unclear or ambiguous only
```

Output schema:
```json
{"findings":[{"gap":"...","severity":"high|medium|low",
              "evidence_ids":["C-0412"],"question":"..."}]}
```

### 5.4 Post-processing — deterministic, unit-tested (D33)
```
1. normalise    strip []`​ and whitespace, uppercase, RCA- → R-        D17
2. filter       drop if evidence_ids empty            → suppressed(no_evidence)
                drop if any id ∉ retrieved(this call) → suppressed(out_of_set)   D3
                log the RAW string either way                                     D17
3. dedup        union-find over shared evidence within one requirement:              D20
                  nodes = findings for that requirement
                  edge  = evidence_ids intersect
                  group = one connected component
                (overlap is NOT transitive — A∩B≠∅ and B∩C≠∅ does not give A∩C≠∅ —
                 so "group by overlap" is undefined without this. Components make it
                 deterministic, and it is the case test/pipeline.test.ts constructs.)
                survivor = highest severity; merged_classes = union of gap_class
4. persist      write ALL findings, including merged-away ones, with
                merged_into_id set on the losers.  Nothing is discarded: a losing
                finding's ai_original and question ARE AI proposals, and D14 makes
                those immutable. BA view filters merged_into_id IS NULL.
```

### 5.5 Phase 2 — after approval only
Four generation calls of the same shape: stories+criteria, tasks (reusing phase-1 `evidence_ids` to
name modules/tables), test scenarios (negative ones seeded from findings via `from_finding_id`).
`trace_links` written structurally at generation time — **no LLM call** (D30).

---

## 6. API

| method | route | rbac |
|---|---|---|
| POST | `/api/documents` upload → enqueue extract | ba, superadmin |
| GET | `/api/runs/:id` status + progress | all |
| POST | `/api/runs/:id/analyze` | ba, superadmin |
| PATCH | `/api/findings/:id` status, edited_text, **ba_verdict**, resolution_note | ba, superadmin |
| PATCH | `/api/requirements/:id` edited_text | ba, superadmin |
| POST | `/api/runs/:id/approve` **the gate** | ba, superadmin |
| POST | `/api/runs/:id/generate` | ba, superadmin |
| PATCH | `/api/{stories,tasks,tests}/:id` | ba, dev, qa, superadmin |
| GET | `/api/runs/:id/export.xlsx` \| `.docx` | ba, pm, superadmin |
| POST | `/api/runs/:id/push?dryRun=true` | ba, pm, superadmin |

Read is open to every signed-in user; only these three action classes gate (D10).
Export returns **409** with the unmapped requirement refs when coverage < 100% (D28).
Every mutation writes `audit_log`.

---

## 7. UI

| screen | shows |
|---|---|
| `/login` | email + password |
| `/` | redirect by role — ba→runs, dev→backlog, qa→tests, pm→matrix (D10) |
| `/runs/:id` | requirements list; findings grouped by requirement. Per finding: gap, severity, question, **citations as links to the real chunk**, accept/edit/dismiss, *"worth asking the client?"* (D24), resolution note (D26). Header: elapsed wall clock (D27), suppression rate (D19). |
| `/runs/:id/backlog` | stories + criteria, tasks, test scenarios; edit + approve each |
| `/runs/:id/matrix` | req → story → test; **coverage %** and unmapped requirements named (D28) |

Approval gate is one explicit action with a confirm, disabled until every finding has a `status`.

---

## 8. Eval harness

```
npm run eval:extraction     # segmentation P/R + classification vs the answer key
npm run eval:gaps           # gap quality, against the answer key's frozen requirements  (D11)
```

`eval:gaps` indexes the **frozen** requirement set under a fixed run id — never a live extraction,
or D3's requirement-chunk IDs drift for exactly the reason D11 exists. (D11, D23)

**The frozen set is the answer key's own `requirements` list**, not a captured extraction run.
Freezing an LLM run renumbers and rephrases, so gap entries keyed to `REQ-007` would silently point
at a different requirement — and the eval would still print a number. One file, no freeze command,
nothing that can drift.

**Strict match** (D12): same requirement + same gap_class + ≥1 overlapping normalised evidence_id.

Report — **per check, never aggregated**, because `missing_ac` scores retrieval@k = 1.00 by
construction and would mask a weak retriever on the two checks doing real work (D12):

```
check           strict-R   retrieval@k
missing_ac          -          1.00   <- degenerate, ignore
failure_path        -           -
contradiction       -           -
dependency          -           -
------------------------------------------
strict recall       -    ✓ ≥0.60  (headline, automated)
loose recall        -           (diagnostic)
suppression rate    -           (D19 — evidence the filter works)
unplanted findings  -           (counted, never scored FP)
precision           -    ✓ ≥0.70  from ba_verdict, BA sessions only (D12 D24)
```

Ground truth carries ~30 planted gaps across 16 requirements, ~2 each, spread over all four classes
— 10 would move recall in 10-point jumps and you would tune against noise (D18).
Every entry names the assumption it rests on (`assumes: A1`) so a BA overturning a domain call is a
grep, not a rewrite (D35).

---

## 9. Configuration

```bash
LLM_BASE_URL=http://host.docker.internal:1234/v1    # asserted private at boot  D31
LLM_MODEL=qwen/qwen3.5-9b
LLM_REASONING_EFFORT=none                           # 30x. non-negotiable.      D7
EMBED_MODEL=text-embedding-nomic-embed-text-v1.5    # 768d                      D6
DATABASE_URL=postgres://setu@db:5432/setu           # host 5433                 D6
SESSION_SECRET=...                                                            # D14
JIRA_PUSH_ENABLED=false                                                       # D15
```

---

## 10. Acceptance — BRD success criteria → how each is evidenced

| BRD criterion | evidenced by |
|---|---|
| Recall ≥60% on known gaps | **met — median 0.70 over 3 runs** (0.67 / 0.83 / 0.70). Pending BA sign-off on `EVIDENCE-REVIEW.md` (D12, D18) |
| Signal quality ≥70% valid | precision from `ba_verdict`, BA review session (D12, D24) |
| 100% findings carry a citation | `finding_evidence` FK + suppression rate > 0 proves the filter runs (D3, D19) |
| Time to first backlog <30 min | `backlog_approved_at − started_at` (D27) — **elapsed wall clock**, not BA-only time |
| Traceability 100% | coverage on `/matrix`; export blocked below 100% (D28) |
| Zero outbound calls | startup assertion + no external network on the app service (D31) |
| Adoption signal | out of build scope |

**Stated openly rather than left for a judge to find:** citations for `missing_ac` point at a
requirement, not "a file, table or ticket" — that interprets the criterion (D3). And the closed-set
filter is not *proven* at ~35 chunks, where k=6 retrieves ~17% of the corpus; the suppression rate is
the honest evidence, not the assertion (D19).

---

## 11. Out of scope

Git / Jira read integration · SSO / LDAP · object storage (D1) ·
document versioning — revisions captured per finding instead (D26) ·
semantic traceability matching — structural by construction (D30) ·
concurrent gap checks — measured slower than sequential (D8) ·
user management UI — users seeded by script (D14).

## 12. Build order

1. **Fixtures** — TypeScript module, DDL, RCAs, prose SRS, `ASSUMPTIONS.md`, ~30 tagged gaps.
   Does not block on BA review.
2. **Eval harness** — nothing downstream is measurable until this exists.
3. **Index + retrieve** — schema lands here; D23/D24/D25 must be settled first (they are).
4. **Gap pipeline** + `test/pipeline.test.ts` alongside.
5. **Review UI + approval gate.**
6. **Phase 2 + matrix + export.**
7. **Stored fallback run** (D22).
