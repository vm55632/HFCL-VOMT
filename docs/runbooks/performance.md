# Runbook — Performance & Load Testing

Validates the Definition-of-Done performance target and gives a repeatable capacity test.

## Target (BUILD_PROMPT §12 Phase 6, §13 DoD)

- **500 concurrent users** sustained.
- **p95 API latency < 500 ms** under that load.
- **Error rate < 1%**.

## Tooling

[k6](https://k6.io) script at [`perf/k6/onboarding.js`](../../perf/k6/onboarding.js). It models a
read-heavy onboarding workload (health, list cases, review queue, dashboard stats, notifications)
behind a login, with think-time, ramping to 500 VUs and holding for 5 minutes. Thresholds encode
the DoD, so the run **fails** (non-zero exit) if p95 ≥ 500 ms or errors ≥ 1% — wire it into a
nightly/staging CI job.

## Running

Run against **staging**, never production (login mutates sessions):

```bash
k6 run -e BASE_URL=https://vop.staging.internal \
       -e VOP_USER=proposer@corp.test -e VOP_PASS='<seeded-break-glass-pass>' \
       perf/k6/onboarding.js
```

Health-only smoke (no auth): omit `VOP_USER`/`VOP_PASS`.

## Environment for a valid test

- Staging sized like prod (or a documented fraction, then extrapolate): API HPA min replicas set,
  PostgreSQL with a read replica, Redis available, object store reachable.
- Break-glass login enabled + user seeded on the target, or swap `loginAndGetCookie()` for the SSO
  flow / a pre-minted session cookie.
- Warm caches once before the recorded run.

## Reading results

k6 prints per-endpoint and aggregate `http_req_duration` (watch **p95**), `http_req_failed`, and
the custom `vop_api_latency` trend. A green run = all thresholds passed.

## Tuning levers (when a threshold fails)

| Symptom                      | Likely cause               | Lever                                                                 |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------- |
| p95 rises with VUs, CPU high | API CPU-bound              | Raise HPA `maxReplicas` / CPU target; check for N+1 in Prisma.        |
| p95 rises, DB CPU high       | Query/index gaps           | Add indexes; route reads to the replica; connection pool (PgBouncer). |
| Errors climb at ramp         | Pool/connection exhaustion | Increase pool size, DB `max_connections`, Redis limits.               |
| Slow list endpoints          | Missing pagination/index   | Enforce `limit`, index sort/filter columns.                           |
| Latency spikes during jobs   | BullMQ contention          | Move heavy work to workers; separate queue nodes.                     |

Scaling is horizontal-first: HPA (CPU/RAM), read replicas, BullMQ workers, object-store throughput.
See `infra/helm/vop` (HPA/PDB) and the DB notes in [database.md](database.md).

## Baseline log (record each run)

| Date                        | Version | Peak VUs | p95 (ms) | Error % | Pass? | Notes |
| --------------------------- | ------- | -------- | -------- | ------- | ----- | ----- |
| _pending first staging run_ |         | 500      |          |         |       |       |
