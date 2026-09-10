# 01 — Skeleton, compose, and the egress assertion

**What to build:** `docker compose up` brings up the app, the worker and a pgvector database, and a health page shows whether the language model is reachable. If the model URL points anywhere public, the app refuses to start and says why. This is the zero-egress guarantee made real on day one, before there is anything to leak.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `docker compose up` starts app, worker and database; app serves on :3000
- [x] Database has the vector extension enabled and migrations run on boot
- [x] Host port for the database avoids the 5432 already in use locally
- [x] Health page reports database reachable and model reachable, and names the model
- [x] App exits non-zero at startup if the model URL is not private (RFC1918, loopback, or CGNAT)
- [x] Health check passes from *inside* the app container, not just from the host shell
- [x] README records the reverse-tunnel command and the bind gotcha that breaks container access

---

## Verified

```
[egress] ok — model endpoint host.docker.internal is private
[migrate] up to date
 ✓ Ready in 247ms
[worker] ready
```

Health page, rendered by the container: database `pgvector 0.8.6` ✅ · model endpoint ✅ ·
chat model `qwen/qwen3.5-9b` ✅ · embedding model `nomic-embed-text-v1.5 (768d)` ✅ · egress ✅

Refusal demonstrated against `api.openai.com` and `8.8.8.8`, both exit 1. Private endpoint exits 0.
Model confirmed reachable from *inside* the app container, not only the host shell.
6/6 unit tests green on the private-range boundaries.

**Deviation from SPEC §1:** the egress assertion runs as a preflight step, not Next's
`instrumentation.ts`. Next compiles instrumentation for the edge runtime as well as node, and
`node:dns` cannot be bundled for edge. A preflight process covers dev, build, start and the worker
identically, with less machinery.
