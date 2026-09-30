// VOP performance test (k6) — steady-state onboarding workload.
//
// Target (docs/BUILD_PROMPT.md §12 Phase 6): 500 concurrent users, p95 API < 500 ms.
//
// Run against a STAGING deployment (never production; login mutates sessions):
//   k6 run -e BASE_URL=https://vop.staging.internal \
//          -e VOP_USER=proposer@corp.test -e VOP_PASS=... \
//          perf/k6/onboarding.js
//
// Auth: local break-glass login must be enabled on the target (VOP_LOCAL_LOGIN_ENABLED=true) and
// the user pre-seeded, OR replace loginAndGetCookie() with your SSO flow / a pre-minted cookie.
// This script only reads (health, list cases, review queue, stats) after login — it does not
// create cases, so it is safe to run repeatedly.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const API = `${BASE}/api/v1`;
const USER = __ENV.VOP_USER || '';
const PASS = __ENV.VOP_PASS || '';

const apiLatency = new Trend('vop_api_latency', true);

export const options = {
  scenarios: {
    steady_state: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 }, // warm up
        { duration: '2m', target: 500 }, // ramp to target concurrency
        { duration: '5m', target: 500 }, // hold at 500 concurrent users
        { duration: '1m', target: 0 }, // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Definition of Done: p95 API latency < 500 ms, error rate < 1%.
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    vop_api_latency: ['p(95)<500'],
  },
};

function loginAndGetCookie() {
  if (!USER || !PASS) return null; // health-only mode
  const res = http.post(`${API}/auth/login`, JSON.stringify({ email: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });
  check(res, { 'login 2xx': (r) => r.status >= 200 && r.status < 300 });
  return res.cookies; // k6 also stores them in the per-VU jar automatically
}

export default function () {
  group('health', () => {
    const r = http.get(`${API}/health/ready`, { tags: { name: 'health_ready' } });
    apiLatency.add(r.timings.duration);
    check(r, { 'ready 200': (res) => res.status === 200 });
  });

  const authed = loginAndGetCookie();
  if (authed) {
    group('read-heavy onboarding traffic', () => {
      const endpoints = [
        { url: `${API}/cases?limit=20`, name: 'list_cases' },
        { url: `${API}/review-queue`, name: 'review_queue' },
        { url: `${API}/stats`, name: 'dashboard_stats' },
        { url: `${API}/notifications`, name: 'notifications' },
      ];
      for (const e of endpoints) {
        const r = http.get(e.url, { tags: { name: e.name } });
        apiLatency.add(r.timings.duration);
        check(r, { [`${e.name} ok`]: (res) => res.status === 200 || res.status === 403 });
        sleep(0.5); // model think-time
      }
    });
  }

  sleep(1);
}
