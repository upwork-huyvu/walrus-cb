# Checklist — Admin web dashboard

Operational panel for admins: list users, linked devices, basic usage data.
Lower traffic, but **high privilege** — treat as a sensitive surface.

## Access control (🔴)
- [ ] Admin-only: requires authentication **and** an admin role/claim, checked on
      every route and on the API side (not just hidden UI).
- [ ] No privileged data fetched with elevated keys from the browser — the admin
      UI calls the NestJS backend, which authorizes. **`service_role` key is
      never in the browser bundle.**
- [ ] Session timeout / logout; ideally stronger auth for admins (2FA if feasible).

## Data handling
- [ ] User/device lists are paginated + filterable server-side; no "fetch all
      users" dumping the table to the client.
- [ ] PII shown is minimized and access is logged.
- [ ] Mutating actions (disable user, unlink device) are explicit, confirmed,
      authorized server-side, and **audit-logged** (who/what/when).

## Web security
- [ ] Output escaping / no `dangerouslySetInnerHTML` with untrusted data (XSS).
- [ ] CSRF protection for cookie-based auth; or token auth done safely.
- [ ] Secrets/env: only public config in client bundle; API base URL per env.
- [ ] Dependencies free of known criticals (`npm audit`).

## UX & quality
- [ ] Loading / empty / error states on every data view.
- [ ] Read vs. write operations clearly separated; destructive actions guarded.
- [ ] Typecheck + lint + build clean; basic component/e2e tests on critical
      flows (login, user list, device unlink).
