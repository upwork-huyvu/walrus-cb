# Checklist - Supabase (Postgres + Auth)

Supabase provides Postgres + Auth. The NestJS backend talks to it; the RN app may
use the Supabase client for auth. Two keys, two trust levels - keep them straight.

## Keys & trust boundary (🔴)
- [ ] **`anon` (publishable) key** only in clients (RN app, admin web).
- [ ] **`service_role` (secret) key** only on the server (NestJS) / secure env -
      NEVER in the app bundle, admin browser JS, or repo. It bypasses RLS.
- [ ] No `service_role` token shipped to the browser or mobile, even temporarily.

## Row Level Security (🔴)
- [ ] **RLS enabled on every table** holding user data (profiles,
      device_mapping, usage, tokens). Default-deny; no table left world-readable.
- [ ] Policies scope rows to `auth.uid()` (a user sees only their own
      devices/usage); admin access via a checked role/claim, not a blanket policy.
- [ ] Policies tested (a user cannot read/modify another user's rows). Don't
      assume - verify the policy SQL.
- [ ] Server code that legitimately needs cross-user access uses `service_role`
      consciously, and that path is itself authorized.

## Auth
- [ ] Providers configured per spec: Email, Google, Apple sign-in; redirect URLs
      / bundle ids correct for native.
- [ ] JWT verification on the backend (issuer/exp/signature) before trusting a
      user id.
- [ ] Email confirmation / password reset flows enabled as required; session
      refresh handled in clients.
- [ ] Apple sign-in requirement (if app offers other social logins) satisfied for
      App Store.

## Data model & migrations
- [ ] Schema/migrations are **in the repo** (`supabase/migrations/`), reviewable
      and reproducible - not only changed via dashboard.
- [ ] `device_mapping` (user ↔ Tuya device/home), `profiles`, usage/summary
      tables have sensible constraints, FKs, indexes on lookup columns.
- [ ] Timestamps (`created_at`/`updated_at`) + soft-delete strategy where needed.
- [ ] No PII stored beyond need; sensitive columns access-controlled.

## Storage / Edge functions (if used)
- [ ] Storage buckets have access policies (not public unless intended).
- [ ] Boundary between Supabase Edge Functions and the NestJS backend is
      intentional (avoid two backends doing the same thing inconsistently).

## Data residency / compliance
- [ ] Supabase project region aligns with the EU data-residency intent of the
      project (consistent with the Tuya Data Center choice). Document the region.
