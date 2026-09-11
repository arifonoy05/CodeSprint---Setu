# Setu

An AI reviewer that checks a draft SRS against the system we have already built — then drafts the
backlog the delivery team works from.

- **`docs/USER_GUIDE.md`** — how to use the app, step by step, per role.
- **`DESIGN.md`** — 35 decisions and why each won. Read this to understand *why*.
- **`SPEC.md`** — what to build. Read this to understand *what*.
- **`.scratch/setu/issues/`** — the work, as 15 tickets in dependency order.

## Quick start

You need **Docker** (Docker Desktop on macOS/Windows, Docker Engine + Compose on Linux) and an
**OpenAI-compatible model endpoint** — LM Studio, Ollama, vLLM, or a gateway such as
[OmniRoute](#running-omniroute-on-docker).

```bash
git clone git@github.com:arifonoy05/CodeSprint---Setu.git setu
cd setu
cp .env.example .env              # optional: compose has working defaults
docker compose up -d --build      # app :3000, worker, pgvector :5433
docker compose exec app npm run seed   # five users, one per role; prints the password
open http://localhost:3000/login
```

Then:

1. Sign in as `admin@bracits.com` (password printed by `npm run seed`, default `setu-demo-password`;
   choose your own with `docker compose exec -e SEED_PASSWORD=... app npm run seed`).
2. Open **Model** in the header (`/settings/model`), enter your endpoint, **Test connection** and
   save. Nothing runs until that test passes — see [Connecting the model](#connecting-the-model).
3. Sign in as `ba@bracits.com` and upload an SRS on **Runs**. The [user guide](docs/USER_GUIDE.md)
   walks through the rest.

For production, set a real `SESSION_SECRET` (32+ characters) in `.env` before `docker compose up`.

### Stopping and resetting

```bash
docker compose down        # stop; data is kept in the setu-db volume
docker compose down -v     # stop and delete the database
docker compose logs -f app worker
```

## Running OmniRoute on Docker

[OmniRoute](https://github.com/diegosouzapw/OmniRoute) is an OpenAI-compatible gateway that fronts
many providers behind one `/v1` endpoint. Run it beside Setu:

```bash
export INITIAL_PASSWORD=$(openssl rand -base64 24)   # dashboard login; defaults to CHANGEME if unset
echo "$INITIAL_PASSWORD"                             # keep this

docker run -d --name omniroute --restart unless-stopped --stop-timeout 40 \
  -p 20128:20128 \
  -v omniroute-data:/app/data \
  -e INITIAL_PASSWORD \
  diegosouzapw/omniroute:latest
```

- The dashboard and the API share port `20128`. The volume at `/app/data` holds its database, keys
  and settings; `--stop-timeout 40` lets it checkpoint cleanly on stop.
- Open `http://localhost:20128`, sign in with `INITIAL_PASSWORD`, and follow the Quick Start:
  **connect a provider** and **create an API key** for Setu.
- Check it answers: `curl -H "Authorization: Bearer <key>" http://localhost:20128/v1/models`

### Pointing Setu at OmniRoute

In Setu, as `admin@bracits.com`, open **Model** (`/settings/model`):

| field | value |
|---|---|
| Endpoint URL | `http://host.docker.internal:20128/v1` — **not** `localhost`, see below |
| API key | the key you created in OmniRoute |
| Chat model | **Load from endpoint**, then pick one |
| Advanced → Embedding endpoint | a local server that serves a **768-dimension** model, e.g. LM Studio at `http://host.docker.internal:1234/v1` with `text-embedding-nomic-embed-text-v1.5` |
| Advanced → Reasoning effort | `none` |

Then **Test connection** and save. Three things to expect:

1. **`host.docker.internal`, not `localhost`.** Setu calls the model from inside its container,
   where `localhost` is the container itself. Compose maps `host.docker.internal` to the host on
   macOS, Windows and Linux. If you type `localhost`, the page offers the corrected URL.
2. **Setu will flag OmniRoute as a gateway.** It is on a private address, but it forwards prompts
   to third-party providers, and Setu recognises that from the model list. Runs stay blocked with
   *"External models are not permitted"* until a superadmin clicks **Allow models outside the
   network…** on the same page and records a reason. That choice sends requirement text, source
   code and incident history outside your network — make it deliberately. The reason is shown on
   `/health`.
3. **Embeddings must be 768 wide.** The database stores `vector(768)`. Most hosted embedding
   models are wider (1536+), so keep embeddings on a local model via the separate embedding
   endpoint. A mismatch is reported by the test and blocks runs.

If OmniRoute runs on another machine, use that machine's address instead of `host.docker.internal`.

## Connecting the model

The endpoint is configured in the app, not the environment: sign in as a superadmin and open
**Settings → Model** (`/settings/model`). Set the URL, an optional API key, and the model names,
then **Test connection**.

The test checks what Setu depends on, not merely that the endpoint replies:

| | |
|---|---|
| reachable | can it list models |
| network | does it resolve inside your network |
| chat + `json_schema` | structured output, or findings will not parse |
| `reasoning_effort` | honoured, or runs take hours instead of minutes |
| embedding width | must match the `vector(768)` the schema stores |

**Nothing runs until that test passes** — uploads return 503 and generation refuses. API keys are
encrypted at rest and never shown again.

A public endpoint (a hosted provider) works, but only after explicitly acknowledging that
requirement text, source code and incident history will leave your network. That contradicts the
BRD's zero-egress requirement, so it is a deliberate, recorded choice rather than a default.

`LLM_BASE_URL` and friends remain as a bootstrap for a fresh install, before anything is saved.

### Connecting a model that runs outside the container

The URL is resolved by **Setu**, not by your browser. Inside a container `127.0.0.1` is the
container itself, so a model on your machine is not reachable there.

| where the model runs | what to enter |
|---|---|
| the machine hosting Setu (LM Studio, Ollama) | `http://host.docker.internal:1234/v1` |
| OmniRoute on the machine hosting Setu | `http://host.docker.internal:20128/v1` + API key |
| another machine on the network | `http://10.0.4.20:1234/v1` |
| a hosted provider | `https://api.provider.com/v1` + API key |

Enter a loopback address and the settings page says why it cannot work and offers the corrected
URL as a one-click fix, rather than failing with a bare "Connection error".

Demonstrated:

```
from your Mac:              127.0.0.1:1234       -> 200
from inside the container:  127.0.0.1:1234       -> CONNECTION REFUSED
                            host.docker.internal -> reachable (192.168.65.254)
```

Running without Docker (`npm run dev`), the app *is* on your machine, so `127.0.0.1` is correct
and `host.docker.internal` will not resolve.

### The old environment-variable route

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

Runs inside the container, so no local checkout or Node install is needed. Configure the model
first — indexing needs the embedding endpoint.

```bash
docker compose exec app npm run seed        # five users, one per role
docker compose exec app npm run index       # index the fixture system (30 chunks)
docker compose exec app npm run seed:demo   # load the stored run, so the walkthrough never depends on a live model
open http://localhost:3000/demo
```

Sign in as `ba@bracits.com` (password from `npm run seed`), then:
**findings → approve → backlog → matrix → export**.

## UI

Tailwind v4, **daisyUI 5** (all 35 default themes) and **shadcn/ui** primitives.

The two libraries have competing theme systems, so daisyUI owns theming and shadcn's
variables are defined in terms of it in `app/globals.css`:

```css
@theme inline {
  --color-background: var(--color-base-100);
  --color-destructive: var(--color-error);
  ...
}
```

A stock shadcn component using `bg-card` or `bg-destructive` therefore compiles straight to
the daisy palette and repaints with the theme, instead of staying on its own colours and
looking broken on 34 of the 35. Nothing in a component hardcodes a colour.

The theme picker is in the header; the choice is stored per-browser and applied before
first paint (`ThemeScript`) so there is no flash on navigation. "system" follows the OS.

## Development

Needs Node 24.

```bash
npm install
docker compose up -d db
npm run dev             # preflight (egress + migrate), then Next on :3000
npm run worker          # pg-boss consumer — runs analysis and generation jobs
npm run seed            # users
npm test                # node --test, no framework

npm run fixtures:check  # the answer key must cite evidence that exists
npm run eval:extraction # segmentation + classification vs the answer key
npm run eval:gaps       # gap recall per check, ~8 min
npm run snapshot:demo   # capture a finished run as fixtures/demo-run.json
```

Without the worker, uploads queue but never progress.

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

Others: `SESSION_SECRET` (32+ chars, signs the login cookie), `SEED_PASSWORD` (password for the
seeded users), `JIRA_PUSH_ENABLED` / `JIRA_BASE_URL` / `JIRA_PROJECT_KEY` / `JIRA_TOKEN` (Jira push;
off by default).
