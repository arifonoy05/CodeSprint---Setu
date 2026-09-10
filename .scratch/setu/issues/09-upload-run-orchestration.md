# 09 — Upload a document and watch it run

**What to build:** A business analyst uploads a requirements document in the browser and watches it work. Extraction, indexing and analysis run in the background, so closing the tab or a dropped connection does not lose the run. Progress is visible and honest about which stage it is in.

**Blocked by:** 04, 08

**Status:** done

- [x] Upload accepts both common document formats and stores the extracted text
- [x] Work runs in a background worker, not inside the web request
- [x] Run state moves through its stages and is visible on screen
- [x] A dropped connection or closed tab does not lose or corrupt the run
- [x] A failed stage retries; a permanently failed run says so rather than hanging
- [x] Re-running does not duplicate requirements or findings

---

## Verified

Upload through the real HTTP boundary, with the correct status for each case:

```
QA uploads                    403   (was 500 — see below)
unsupported file type         415
document with too little text 422
BA uploads the real SRS       202   {"runId":9}
```

Run 9 end to end, polled the way the UI polls:

```
extracting | queued                                    | 0/0
analyzing  | checking requirements against the system  | 4/76
analyzing  | ...                                       | 14/76
review     |                                           | 72/72
18 requirements, 63 findings
```

### The resilience design was proven by a real failure, not a thought experiment

```
[worker] run 9 starting
[worker] run 9 failed: Connection error.     <- LM Studio dropped mid-run
[worker] run 9 starting                      <- pg-boss retried; completed
```

D34 predicted exactly this ("tunnels drop, laptops sleep") and D5 chose pg-boss for the retries.
Afterwards: 18 requirements, 18 distinct refs — the retry duplicated nothing, because `processRun`
clears the run's prior output before rebuilding it. **0 uncited findings across every run in the
database.**

### A refusal was reporting as a server error

`requireCan` throws, and Next renders a thrown error as HTTP 500 — so a QA being denied upload
looked like the application breaking. That hides authorization failures inside error logs and tells
the user the wrong thing. Route handlers now use a separate `apiUser()` that returns 401/403 as a
value; pages keep redirecting. The two cannot share a path because `redirect()` throws a
control-flow signal that must not be caught.
