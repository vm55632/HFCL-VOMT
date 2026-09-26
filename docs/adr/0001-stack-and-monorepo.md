# ADR-0001 — Stack & monorepo

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture (with client, section-14 Q1)

## Context

We are building a production-grade, security-first vendor onboarding platform for a regulated
Indian enterprise. The system needs: strong provider/dependency-injection support (an
adapter-per-external-concern design is central to the cloud-agnostic requirement), a form-heavy
frontend driven by category configuration, shared validation between client and server, and a
codebase that InfoSec can reason about. The prompt suggests TypeScript/NestJS or Java/Spring.

## Decision

- **Backend: TypeScript + NestJS 10.** NestJS's first-class DI cleanly expresses the
  provider/adapter pattern (bind an interface token to the adapter selected by config). One
  language across the stack lets the frontend, backend and shared domain model share types and
  Zod schemas, removing a class of drift bugs. The existing reference prototype is Node/JS, so
  the domain logic ports directly.
- **Frontend: Next.js 14 + TypeScript**, accessible component library, schema-driven forms.
- **Monorepo: pnpm workspaces + Turborepo.** `apps/{api,web}`, `packages/{shared,config}`.
  pnpm gives a content-addressed store and strict, reproducible installs; Turborepo gives
  cached, parallel `build/lint/test/typecheck`.
- **API:** REST under `/api/v1`, OpenAPI 3 generated from decorators.

Java/Spring Boot was considered and remains viable if the client mandates JVM tech standards;
it was not chosen because it would split the domain model across two languages and add no
capability we need here.

## Consequences

- Shared types/validation live once in `packages/shared`; both sides import them.
- Node is single-threaded per process — CPU-heavy work (document scanning, crypto) is delegated
  to providers/workers, keeping the app tier stateless and horizontally scalable.
- Team must be fluent in TypeScript and the NestJS module/provider model.
- Corepack is required to pin pnpm; documented in `CLAUDE.md`.
