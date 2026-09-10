# 15 — Stored fallback run

**What to build:** Insurance. A complete, already-approved run kept in the database and reachable by a flag, so a bad minute from a local model on stage is a shrug rather than a dead demo. It is not a deception — it is a saved result, and saying so out loud costs nothing.

**Blocked by:** 13

**Status:** done

- [x] A complete run — findings, backlog, matrix — is seeded by a script
- [x] A flag opens the stored run instead of generating a new one
- [x] The stored run is visibly labelled as stored
- [x] Seeding is repeatable and does not disturb real runs
- [x] Every screen in the demo path works from the stored run

---

## Verified

```
npm run snapshot:demo   -> fixtures/demo-run.json (245 KB)
npm run seed:demo       -> seeded demo run, 18 requirements · 115 findings · 19 stories · 175 tests

/demo            -> 307 /runs/13
/runs/13         200  banner:yes  content:yes
/runs/13/backlog 200  banner:yes  content:yes
/runs/13/matrix  200  banner:yes  content:yes
/runs list marks it "stored"
export from the stored run: 200, 42,851 bytes
```

Re-seeded three times in a row:

```
demo runs: 1 · real runs: 9 (untouched) · orphan citations: 0
```

The banner says what it is rather than hiding it — *"A previously generated and approved analysis,
kept so the walkthrough does not depend on the model responding live."* A saved result stated
plainly is honest; a hidden one is not.

## Repeatability testing found a real bug

The second seed failed with `finding_evidence_chunk_id_fkey`. The seeder deleted the previous demo
run's chunks *before* deleting the run, but its findings still cited them — and that foreign key is
`ON DELETE RESTRICT` by design (D3: a citation pins its evidence, so deleting cited evidence must
fail loudly).

**The constraint was working; the delete order was wrong.** The run goes first, cascading findings
and their citations, then the run-scoped requirement chunks. Had the FK been `CASCADE` for
convenience, this would have silently orphaned citations instead of failing — the failure was the
useful outcome.

Requirement chunk ids embed their run (`REQ-001@13`, D23), so they are rewritten on import and every
cross-reference — findings, evidence, stories, tasks, tests, trace links, merged-into pointers — is
remapped from old ids to new.


---

## Post-review fixes

Three gaps found reviewing the finished build. Two would have failed on the demo machine.

**The README's demo path could not run in the container.** The image copied `lib`, `bin`, `worker`
only — not `fixtures`, `scripts` or `eval`. Every time those commands were run they ran from the
host against `localhost:5433`, so `docker compose exec app npm run seed:demo` failed. Given D34
puts the app on a remote server, requiring a repo checkout beside it would be a second install to
keep in step, so the directories now ship in the image. Verified inside the container:

```
docker compose exec app npm run seed:demo   -> seeded demo run #15
docker compose exec app npm run index       -> indexed 30 chunks
docker compose exec app npm run fixtures:check -> ✓ fixtures valid
```

**`seed:demo` silently wrote wrong embeddings on a clean install.** It looked each chunk's vector up
in the local database and fell back to *an arbitrary RCA's embedding* when the source run was
absent. On the machine that produced the run it worked; anywhere else every requirement chunk got a
meaningless vector, and nothing looked wrong because the screens read text, not vectors. Embeddings
now travel inside `demo-run.json` (768 dims each) and a missing one fails loudly.

**No server action had ever executed.** Every earlier probe re-implemented the logic in SQL —
proving intent, not wiring. The actions are now invoked over real HTTP using their ids from
`.next/server/server-reference-manifest.json`:

```
decideFinding      200  -> status=accepted verdict=valid decided_by=set
editRequirement    200  -> edited=yes, ai_original intact
decideArtifact     200  -> story status=accepted
approveRun as BA   200  -> approved=true
4 audit rows written

refused operations changed nothing:
  QA dismiss          status accepted -> accepted   ✓
  edit post-approval  text unchanged                ✓
  PM approve          approved_by unchanged         ✓
```
