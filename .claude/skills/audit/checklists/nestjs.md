# Checklist - NestJS backend (on Vercel)

Backend = NestJS REST API, deployed serverless on Vercel, using Supabase for
Postgres + Auth. Audit Supabase concerns with `supabase.md` too.

## Structure & DI
- [ ] Feature modules with clear boundaries (auth, users, devices/mapping,
      notifications); providers injected, not `new`-ed; no circular deps.
- [ ] Controllers thin (HTTP only); business logic in services.
- [ ] Config via `@nestjs/config` (validated schema), never `process.env.X`
      scattered or hardcoded secrets.

## Validation & contracts
- [ ] DTOs with `class-validator`; global `ValidationPipe({ whitelist: true,
      forbidNonWhitelisted: true, transform: true })` - no unvalidated bodies.
- [ ] Response shapes consistent (serializer/interceptor); internal entities not
      leaked raw to clients.
- [ ] Pagination on list endpoints (admin user/device lists) - no unbounded
      queries.

## Auth & authorization
- [ ] Auth guard verifies the **Supabase JWT** (validates signature/issuer/exp
      against Supabase JWKS/secret) - not just decoding without verifying.
- [ ] Role/ownership checks (a user only sees their own devices; admin role for
      admin endpoints) enforced server-side via guards, not trusted from client.
- [ ] `service_role` key used **only** server-side; never returned to clients.

## Security middleware
- [ ] `helmet`, sane CORS (explicit origins, not `*` with credentials), rate
      limiting (`@nestjs/throttler`) on auth + sensitive routes.
- [ ] No secrets/PII in logs; stack traces not returned to clients in prod.
- [ ] Webhooks (if any: Tuya/FCM) verify signatures before acting.

## Errors & resilience
- [ ] Global exception filter → consistent error responses + proper HTTP codes.
- [ ] All async paths awaited; no floating promises / unhandled rejections.
- [ ] External calls (Supabase, Tuya cloud, FCM) have timeouts + handled failure;
      no infinite hangs.

## Serverless (Vercel) specifics
- [ ] App is request-stateless (no in-memory session/cache assumed to persist;
      cold starts expected). Heavy bootstrap minimized.
- [ ] **Postgres connections use the Supabase pooler / pgBouncer-style pooling**
      - opening a fresh direct connection per invocation exhausts connections on
      serverless. Verify connection strategy.
- [ ] No reliance on long-lived background jobs/timers inside the function;
      long work offloaded (queue/edge/cron) appropriately.
- [ ] Function bundle size + cold-start kept reasonable.

## Notifications (FCM) - server side
- [ ] FCM **server credentials** server-only; push send wrapped in a service
      with retry + invalid-token cleanup (remove dead device tokens).
- [ ] Device token storage keyed to user; multi-device per user handled.

## Testing & quality
- [ ] Unit tests for services (business rules: device mapping, ownership);
      e2e tests for critical endpoints; CI runs lint + test + build.
- [ ] `npm run build` clean; strict TS (`strict: true`), no stray `any` on
      boundaries.
