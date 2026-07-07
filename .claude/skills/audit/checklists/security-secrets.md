# Checklist - Secrets & cross-cutting security (ALWAYS applies)

Run this on every audit regardless of scope. The fastest way to fail this project
is a leaked key or a missing access control.

## Secret inventory - where each MUST live
| Secret | Allowed location | Must NOT be in |
|---|---|---|
| Tuya **AppKey** | client native config (public-ish) | - (low risk) |
| Tuya **AppSecret** | server / native secure config, git-ignored | JS bundle, repo, logs |
| Supabase **anon** key | clients (RN, admin) | - (public by design) |
| Supabase **service_role** key | NestJS server env only | app bundle, browser, repo |
| FCM **server key / service account** | NestJS server env only | app bundle, repo |
| Signing keystore / provisioning / `GoogleService-Info.plist` secrets | local/CI secret store | repo |

## Checks
- [ ] **Grep the repo** for leaked secrets: `service_role`, `AppSecret`, private
      keys (`BEGIN PRIVATE KEY`), `eyJ...` long JWTs, `firebase`/`google` service
      account JSON, `.pem`/`.p8`/`.keystore`/`.jks` files. Any hit in tracked
      files = 🔴.
- [ ] `.gitignore` covers: `.env*` (except `.env.example`), `*.keystore`, `*.jks`,
      `*.p8`, `*.p12`, `google-services.json`, `GoogleService-Info.plist`,
      `ios/Pods`, build outputs, Tuya secured asset files.
- [ ] `.env.example` exists with **placeholder** values documenting required vars
      (no real secrets).
- [ ] If git history exists, check secrets weren't committed earlier then removed
      (still in history → rotate + scrub).

## Transport & data
- [ ] All backend/API traffic over HTTPS; no `http://` endpoints in client config.
- [ ] No secrets/PII/tokens written to logs or crash reports.
- [ ] Tokens at rest on device in Keychain/Keystore, not plaintext storage.

## Access control (cross-cutting)
- [ ] Every API endpoint authenticates + authorizes server-side; no "security by
      obscurity" (hidden UI but open API).
- [ ] Principle of least privilege on all keys/roles.

## Supply chain & compliance
- [ ] `npm audit` (mobile, backend, admin) - no unaddressed criticals; lockfiles
      committed.
- [ ] Data residency consistent (Supabase region ↔ Tuya Data Center, EU intent).
- [ ] Privacy: iOS Privacy Manifest (Tuya provides one - include it), Android
      data-safety; collected data documented.
