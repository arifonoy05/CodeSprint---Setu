# Setu

An AI reviewer that checks a draft SRS against the system we have already built — then drafts the
backlog the delivery team works from.

- **`DESIGN.md`** — 35 decisions and why each won. Read this to understand *why*.
- **`SPEC.md`** — what to build. Read this to understand *what*.
- **`.scratch/setu/issues/`** — the work, as 15 tickets in dependency order.

## Running it

```bash
docker compose up -d          # app :3000, worker, pgvector :5433
open http://localhost:3000/health
```

The model is **not** part of compose — it runs on a separate machine (D34).

## Connecting the model

The app sends client business logic to the model endpoint, so that endpoint must be private.
**The app refuses to start otherwise** (D31) — this is enforced, not documented:

```bash
$ LLM_BASE_URL=https://api.openai.com/v1 npm run preflight
[egress] REFUSING TO START
LLM_BASE_URL resolves to a public address (172.66.0.243, 162.159.140.245). Setu sends client
business logic to this endpoint and will not do so over a public network. Use a reverse tunnel
or VPN so the model is reachable privately.
```

For the demo, the app runs on a remote server and the model runs in LM Studio on a laptop. Join them
with a reverse tunnel — the laptop dials out, nothing on it ever listens publicly:

```bash
# from the laptop running LM Studio
ssh -R 0.0.0.0:1234:localhost:1234 user@server
```

### The gotcha that eats a demo morning

`ssh -R` binds to the server's `127.0.0.1` by default, which **a container cannot reach**. It has to
bind where the Docker bridge can see it — hence `0.0.0.0` above, which needs
`GatewayPorts clientspecified` in the server's `sshd_config`.

Always verify from *inside* the container, never from the server shell:

```bash
docker compose exec app wget -qO- http://host.docker.internal:1234/v1/models
```

Tailscale works too; its CGNAT range is already allowed by the egress check.

## The demo path

```bash
npm run seed           # five users, one per role
npm run index          # index the fixture system (30 chunks)
npm run seed:demo      # load the stored run, so the walkthrough never depends on a live model
open http://localhost:3000/demo
```

Sign in as `ba@bracits.com` (password from `npm run seed`), then:
**findings → approve → backlog → matrix → export**.

## Development

```bash
npm install
docker compose up -d db
npm run dev             # preflight (egress + migrate), then Next
npm run worker          # pg-boss consumer
npm test                # node --test, no framework

npm run fixtures:check  # the answer key must cite evidence that exists
npm run eval:extraction # segmentation + classification vs the answer key
npm run eval:gaps       # gap recall per check, ~8 min
npm run snapshot:demo   # capture a finished run as fixtures/demo-run.json
```

## Measured quality

| | |
|---|---|
| strict gap recall | **0.70** median over 3 runs (0.67 / 0.83 / 0.70), target ≥0.60 |
| loose gap recall | 0.93 — right gap on the right requirement |
| retrieval@k | 0.91 |
| extraction recall | 0.94–1.00, classification 0.93 |
| traceability coverage | 100%, and export is blocked below it |
| uncited findings | 0, across every run |

Numbers vary by up to ±0.15 between identical runs. Report medians, never one run.

`eval:gaps` matches against a widened evidence key that is **pending BA sign-off** — see
`fixtures/EVIDENCE-REVIEW.md`. Until that comes back, treat the headline as internal.

## Configuration

See `.env.example`. Two values are load-bearing:

| variable | why it matters |
|---|---|
| `LLM_BASE_URL` | asserted private at every start (D31). OpenAI-compatible, so LM Studio today and vLLM later is an env change, not a code change (D7). |
| `LLM_REASONING_EFFORT` | must stay `none`. Measured 215s → 4s per call. With reasoning on, an analysis run takes 3.6 hours instead of 3 minutes (D7). |
