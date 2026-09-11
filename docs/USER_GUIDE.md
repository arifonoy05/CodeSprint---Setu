# Setu user guide

Setu reads a draft SRS, checks every requirement against the system you have already built (its
code, database schema and incident history), and flags the gaps. A Business Analyst decides on each
gap and approves the requirements; only then does Setu draft the backlog — stories, development
tasks and test scenarios — and trace every requirement to a story and a test.

To install and run Setu, see the [README](../README.md).

## The flow at a glance

```
Upload SRS ─▶ Analysis ─▶ Review findings ─▶ Approve requirements ─▶ Generate backlog
                                                                          │
      Export / Jira ◀── Traceability (100% coverage) ◀── Approve backlog ◀─ Review backlog
```

Every run page shows this as a stepper with three phases:

| phase | tabs |
|---|---|
| **Review** | **Findings** |
| **Backlog** | **Stories**, **Tasks**, **Tests** — locked 🔒 until the requirements are approved |
| **Delivery** | **Traceability** |

A number on a tab is how many items still need a decision; a ✓ means all are decided. A small dot
marks the tab your role usually works in.

## Roles

Everyone who is signed in can **read** everything. Only these actions are restricted:

| action | who |
|---|---|
| Configure the model and network policy | superadmin |
| Upload an SRS, dismiss findings, approve requirements, generate and approve the backlog | BA, superadmin |
| Export (XLSX / DOCX) and Jira push | BA, PM, superadmin |
| Accept or edit findings, answer "Worth asking the client?", add client notes, revise requirement text, accept/edit/drop backlog items | everyone |

The seeded accounts (password printed by `npm run seed`):

| account | role |
|---|---|
| `admin@bracits.com` | superadmin |
| `ba@bracits.com` | BA |
| `dev@bracits.com` | Dev lead |
| `qa@bracits.com` | QA lead |
| `pm@bracits.com` | Delivery manager |

There is no sign-up and no user management screen — users are created by the seed script.

## 1. Sign in

Open `http://localhost:3000`, enter **Email** and **Password**, and click **Sign in**. The header
then shows **Runs**, **Health**, your name and role, a theme picker and **Sign out**. Superadmins
also see **Model**.

## 2. Connect the model (superadmin, once)

Until a model endpoint is configured and verified, the upload card on **Runs** is replaced by a
notice such as *No model configured* or *Model connection not verified*.

1. Click **Model** in the header.
2. Enter the **Endpoint URL** — any OpenAI-compatible `/v1` URL. Setu calls it from its container,
   so for a model on the same machine use `http://host.docker.internal:<port>/v1`, not
   `localhost`. If you type `localhost`, a warning offers the corrected URL — click
   **Use this instead**.
3. Add the **API key** if the endpoint needs one. It is encrypted and never shown again.
4. Click **Load from endpoint** and choose the **Chat model**.
5. Under **Advanced**, check the **Embedding model** (must produce 768-dimension vectors) and keep
   **Reasoning effort** at *none — recommended*. If the chat endpoint cannot do embeddings (common
   for gateways such as OmniRoute), set a separate **Embedding endpoint**.
6. Click **Test connection**, then **Save and verify**.

The connection test lists each check — *Endpoint reachable*, *Inside your network*,
*Chat completion*, *Structured output*, *Reasoning setting honoured*, *Embeddings* — so you can
see exactly what failed.

### Network policy

By default Setu is **Internal models only**: requirement text, source code and incident history
must not leave your network. A hosted provider, or a gateway that forwards to one, is blocked with
*External models are not permitted*.

To use one anyway, click **Allow models outside the network…**, give a reason (at least 10
characters) and confirm with **Allow external models**. The reason is recorded against your name
and shown on the **Health** page. **Restrict to internal models** reverses it.

## 3. Upload a draft SRS (BA)

On **Runs**, use **Upload a draft SRS**: choose a file and click **Analyse**.

- Accepted formats: **DOCX, PDF, Markdown (.md), plain text (.txt)**.
- The document needs at least 200 characters of text.

The run appears in the table and moves through *queued* → *extracting requirements* →
*checking requirements against the system*. A progress bar shows how many checks are done. You
can close the tab — the analysis runs in the background. A typical run takes a few minutes.

The **Runs** table shows each run's status, number of findings, and how many still await a
decision.

## 4. Review findings

Open a run to land on **Findings**. The top row summarises **Requirements**, **Findings**,
**Suppressed** (duplicates merged away), **Signal quality** and **Elapsed** time.

Each requirement is a card with its reference, a classification, and the requirement text. Under
it are the findings — gaps Setu found in that requirement. There are four kinds of check:

| check | what it catches |
|---|---|
| **missing ac** | no acceptance criteria, so nobody can tell when it is done |
| **failure path** | what happens when it goes wrong is not specified |
| **contradiction** | it conflicts with how the existing system behaves |
| **dependency** | it relies on something that is not stated or not in place |

Each finding shows a **severity** (high / medium / low), the gap, a **question for the client**,
and **evidence chips** — click one to see the code, schema or incident report it cites. Every
finding is backed by evidence.

For each finding, decide:

- **Accept** — the gap is real and should be raised.
- **Edit** — reword it, then **Save**. The original AI text stays visible for reference.
- **Dismiss** (BA only) — not a real gap.

Optionally:

- **Worth asking the client? Yes / No** — feeds the *Signal quality* figure; it is not a decision.
- **What the client said** — record the answer and click **Save note**.
- **revise** next to the requirement text — correct the requirement itself. The original stays
  visible under *As extracted from the document*.

Tick **Show pending only** to hide what is already decided.

## 5. Approve the requirements (BA)

The banner above the findings reads **Awaiting sign-off** — nothing is generated, exported or
pushed before this step.

When every finding is decided, click **Approve requirements** and confirm with **Yes, approve**.
This fixes the requirement set: findings and requirement text become read-only, and the
**Backlog** tabs unlock. It cannot be undone from the UI.

## 6. Generate and review the backlog

Open **Stories** and click **Generate backlog** (BA). Setu drafts, for each requirement:

- **Stories**, with Given / When / Then acceptance criteria.
- **Tasks** for developers, tagged with the code modules and database tables they touch.
- **Tests** — positive and negative scenarios; some are marked *covers a reviewed gap*.

Progress shows as *Drafting the backlog… n/total requirements*. If it shows
*Generation never started*, click **Start generation again**.

Each role reviews its own tab — BA on **Stories**, developers on **Tasks**, QA on **Tests** — and
decides each item with **Accept**, **Edit** or **Drop**.

When nothing is pending, the BA clicks **Approve backlog**. The banner then records who approved it
and how long it took from upload to approved backlog.

## 7. Traceability, export and Jira

Open **Traceability**. It shows **Coverage %** — the share of requirements that map to at least one
story *and* one test (dropped items do not count) — and a table of
**Requirement / Story / Test scenario**. Gaps show as *no story* or *no test*.

Exports (BA, PM, superadmin):

- **Backlog (XLSX)** — sheets for Stories, Tasks, Tests and Traceability. **Blocked below 100%
  coverage**; the page lists which requirements are missing a story or test. Fix them on the
  backlog tabs.
- **Client question sheet (DOCX)** — *Questions for the client*, built from every finding that was not dismissed.
  Available at any time.

**Preview Jira push (dry run)** shows the Jira issues Setu would create, one per story, without
contacting Jira. A real push must be enabled by an administrator (`JIRA_PUSH_ENABLED=true`) and
needs an approved backlog.

## Demo run

`/demo` opens a stored, already-approved run, so you can walk through the whole flow without a live
model. A **Stored run** banner marks it. If it says *No stored run*, an administrator needs to run
`npm run seed:demo` (see the README).

## Health

**Health** shows whether Setu is ready: **Database**, **Model endpoint**, **Chat model**,
**Embedding model**, **Network policy**, **Endpoint** and **Ready to run**. Check it first when
something is blocked.

## Troubleshooting

| you see | meaning / fix |
|---|---|
| *No model configured* / *Model connection not verified* | a superadmin must set up **Model** and pass **Test connection** |
| *External models are not permitted* | the endpoint is outside your network or forwards there; switch to an internal model, or a superadmin allows external models with a reason |
| *Embedding width mismatch* | the embedding model is not 768-dimension; pick one that is |
| *That address is not reachable from Setu* | use `host.docker.internal` or the model machine's address instead of `localhost` |
| **Approve requirements** is greyed out | some finding is still undecided, or you are not a BA |
| Backlog tabs are locked | the requirements are not approved yet |
| **Backlog (XLSX)** is greyed out | coverage is below 100% — see the list on **Traceability** |
| A run stays *queued* | the worker is not running (`docker compose ps`, `docker compose logs worker`) |
| *not permitted to …* | your role cannot perform that action — see [Roles](#roles) |
