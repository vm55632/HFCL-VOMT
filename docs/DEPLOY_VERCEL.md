# Deploying the VOP web app to Vercel

Vercel hosts the **Next.js web app** (`apps/web`). The **NestJS API** (`apps/api`) is a long-running
server (Prisma + PostgreSQL + Redis/BullMQ) and must be deployed to a Node host — Render, Railway,
Fly.io, Azure Container Apps, or the provided Docker image / Helm chart — **not** Vercel. The Vercel
app talks to that API over HTTPS via `NEXT_PUBLIC_API_URL`.

## 1. Create the Vercel project

1. Import this Git repository in Vercel.
2. **Set Root Directory to `apps/web`.** Vercel then reads `apps/web/vercel.json`, which already sets:
   - Framework: **Next.js**
   - Install: `pnpm install --frozen-lockfile` (installs the whole pnpm workspace)
   - Build: `pnpm --filter @vop/shared build && pnpm --filter @vop/web exec next build`
     (builds the shared package first, then the app)
3. Node version: 20 or 22 (Project Settings → General).

On Vercel the build skips Next's `output: 'standalone'` automatically (it is only used for the Docker
image), via `output: process.env.VERCEL ? undefined : 'standalone'` in `next.config.mjs`.

## 2. Environment variables (Project → Settings → Environment Variables)

| Variable                        | Example                              | Notes                                                           |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | `https://api.your-domain.com/api/v1` | Public base URL of the deployed NestJS API (include `/api/v1`). |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://YOUR-REF.supabase.co`       | Supabase project URL (public).                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`                             | Supabase anon key (public by design; RLS/JWT protect data).     |

All three are `NEXT_PUBLIC_*` (read in the browser) and are inlined at build time, so set them before
the first deploy and redeploy after any change. Leaving the Supabase pair blank falls back to the
built-in local/SSO login.

## 3. Make the API reachable from Vercel

The web app authenticates by sending the Supabase JWT as a `Bearer` token (works cross-origin), and
also sends cookies (`credentials: 'include'`). On the API side:

- **CORS:** allow the Vercel origin (e.g. `https://your-app.vercel.app` and any custom domain) with
  credentials enabled.
- **Cookies:** for the httpOnly session cookie to work cross-site, set it `SameSite=None; Secure`.
  (Bearer-token auth still works even if the cross-site cookie is dropped.)
- Serve the API over **HTTPS**.

## 4. Deploy

Push to the production branch (or click **Deploy**). Verify:

- `https://<your-app>.vercel.app/sign-in` loads,
- sign-in succeeds and `/dashboard` calls `NEXT_PUBLIC_API_URL/auth/me` (200) with no CORS errors.

## Local production build (parity check)

```bash
pnpm --filter @vop/shared build
VERCEL=1 pnpm --filter @vop/web exec next build
```

`VERCEL=1` skips the standalone step so it matches the Vercel build (and avoids the Windows symlink
`EPERM` from `output: 'standalone'`).
