# Security Hardening Guide

Summary of security work done in September 2026, plus infra-level steps that
are ready to apply but live outside this repo (Nginx Proxy Manager config).

## 1. Anti-spam on the public onboarding/offboarding form

**Problem:** `POST /api/public/onboarding` started receiving spam. It already
had an IP rate limiter (5 requests / 15 min), which doesn't stop bots that
rotate IPs.

**Fix (no external dependency, no friction for real users):**

- **Honeypot** — a hidden `website` field (positioned off-screen,
  `tabIndex=-1`) that no human sees or fills, but bots that auto-fill every
  field do.
- **Time trap** — a submission arriving less than 2 seconds after the form
  loaded is rejected (no human fills this form that fast).
- Both cases return a fake "success" response (nothing is saved, no email is
  sent) so scripted spam doesn't learn to adapt.

Files: `server/index.js`, `src/components/PublicOnboardingForm.tsx`,
`src/services/api.ts`.

**If spam continues:** next step is **Cloudflare Turnstile** (free, invisible
captcha). Requires creating a Cloudflare account and generating a Site Key
(frontend) + Secret Key (backend) to verify server-side. Evaluated, not
implemented — wait and see if the honeypot is enough first.

## 2. Discard pending onboarding/offboarding requests

**Problem:** the admin panel only had "Procesar" (requires picking a
client/project, creates a task). No way to drop a mistaken or spam
submission without processing it.

**Fix:** `DELETE /api/admin/onboarding/:id` + a "Descartar" button (red, with
confirmation) next to "Procesar", for pending requests only. Also deletes
associated `onboarding_updates` rows by hand, since this project doesn't run
with `PRAGMA foreign_keys = ON`, so `ON DELETE CASCADE` doesn't actually fire
in SQLite here.

Files: `server/index.js`, `src/services/api.ts`,
`src/components/OnboardingAdminPanel.tsx`.

## 3. Critical fix: the "demo-token" auth bypass

### The problem

- Login correctly validated username/password with bcrypt.
- But `POST /api/auth/login` always returned the same fixed string:
  `"demo-token"`.
- The `authenticateToken` middleware protecting every admin route just
  compared `token === 'demo-token'` — no real session, no expiration, not
  tied to which user actually logged in.

**Impact:** anyone who saw that string (visible in any browser's network
tab) had full admin API access without a password. Leftover scaffolding
code (`// In production, use JWT` was the comment) that was never replaced.

This also silently broke two other things:
- The Activity Log attributed every action to `admin-1`, regardless of which
  user actually did it.
- The self-or-admin check on `PUT /api/users/:id/password` never worked as
  intended, since `req.user` was always the same hardcoded object.

There was also no login rate limiting at all (a `login_attempts` column
existed in the `users` table but was never used).

### The fix

1. **Real JWT** — added `jsonwebtoken`. Login now signs a real token: signed,
   24h expiration, carrying the actual logged-in user's id/username/role.
2. `authenticateToken` now verifies signature + expiration instead of
   comparing against a fixed string.
3. **Login rate limiter** — 5 attempts / 15 min per IP (same pattern already
   used on the onboarding form).
4. `JWT_SECRET` documented in `.env.example`, with the command to generate
   one: `openssl rand -hex 32`.

### ⚠️ Action required in production

**Set `JWT_SECRET` in the production `.env`.** If unset, the server still
starts (doesn't crash) but falls back to an insecure dev secret and logs a
warning. Generate one with:

```bash
openssl rand -hex 32
```

### Tests run

- Old `demo-token` is now rejected (403)
- Correct login issues a valid JWT (3 dot-separated parts)
- Wrong password gives 401
- 6th login attempt in 15 min gives 429 (rate limit)
- Full flow tested in a real browser with Playwright: login → session
  persisted → navigating to protected pages without being bounced

Files: `server/index.js`, `.env.example`, `package.json`/`package-lock.json`
(new dependency: `jsonwebtoken`).

## 4. Edge rate limiting (Nginx Proxy Manager)

**Not applied yet** — this lives outside this repo, in NPM's own config, not
in code here. Snippet ready to paste when convenient.

Confirmed by reading `Dockerfile`/`docker-compose.yml`: production runs pure
Node — `server/index.js` serves `dist/` directly via `express.static`, on
port 3000. The `nginx.conf` file in this repo is **not used in production**.
The only proxy in the real request path is NPM itself (a single hop, which
matches `app.set('trust proxy', 1)` already in `server/index.js`).

### 4.1 — Rate limit zone

Goes in `/data/nginx/custom/http_top.conf` on NPM's data volume/container
(edited by hand — there's no UI field for this). Restart the NPM container
after editing so it picks it up.

```nginx
# TaskTracker Pro — general API rate limit (edge, before it reaches Node)
limit_req_zone $binary_remote_addr zone=tt_api:10m rate=10r/s;
limit_req_status 429;
```

`10m` tracks roughly 160,000 IPs — plenty. If this file ends up shared across
other services proxied by the same NPM instance, prefix each zone name per
service (`tt_api`, `otherservice_api`, ...) so they don't collide.

### 4.2 — The actual rule

Goes in the **"Advanced" tab** of the TaskTracker Pro Proxy Host in the NPM
UI (per-host, unlike the zone above):

```nginx
location /api/ {
    limit_req zone=tt_api burst=20 nodelay;

    proxy_pass http://FORWARD_HOST:FORWARD_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
}
```

Replace `FORWARD_HOST:FORWARD_PORT` with whatever is already set in that
same Proxy Host's "Details" tab (Forward Hostname/IP + Forward Port) — it
has to be repeated here because this `location` block is independent from
the one NPM generates automatically. The `proxy_set_header` lines are
required: without them this route loses the real client IP, breaking both
this rate limit and the one already inside the app.

`/api/` (general) was chosen over a login-specific zone because Express
already rate-limits `/api/auth/login` and `/api/public/onboarding`
precisely. This edge layer is about shielding Node from a high-volume flood
before it even gets there, not duplicating the brute-force guard.

### 4.3 — Verifying it

```bash
for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}\n" https://your-domain/api/clients; done
```

Expect a run of `200`/`401` (depending on auth), then `429` once the burst
is exhausted.

## 5. Monitoring it with GoAccess

Also not applied yet — a note for when the NPM rate limit above is in place.
GoAccess reads nginx access logs, so it sees traffic **at the edge**, before
it reaches Node. That makes it the right tool to confirm two things here: (a)
that the honeypot/time-trap actually cut spam volume to
`/api/public/onboarding`, and (b) how often the new `429` rate limit is
firing, to know whether `rate=10r/s` needs to go up (blocking real traffic)
or down (still letting an obvious flood through).

**Where the logs are:** NPM writes one access log per Proxy Host, typically
at `/data/logs/proxy-host-<N>_access.log` in its container/volume (the `<N>`
is that Proxy Host's ID, visible in the NPM UI's URL when editing it).

**Gotcha:** GoAccess needs `--log-format` to match exactly what NPM writes,
or the report comes out empty or garbled. NPM's default is close to the
standard combined log format:

```bash
goaccess /data/logs/proxy-host-<N>_access.log \
  --log-format=COMBINED \
  -o /path/to/report.html --real-time-html
```

If that's empty/garbled, check the actual `log_format` NPM is using (its
default templates live under `/app/templates` inside the NPM image) and pass
a matching `--log-format` string instead of `COMBINED`.

**Worth checking once it's parsing correctly:**
- Requests to `/api/public/onboarding` over time — should drop sharply after
  the honeypot/time-trap deploy.
- Status code breakdown — watch `429` show up once the NPM rate limit is
  live, and how often.
- Top IPs / user agents hitting `/api/` — tells you whether `rate=10r/s`
  is tuned right.

Limitation to keep in mind: GoAccess reads flat log files, so if NPM rotates
or truncates logs aggressively, the historical trend view is only as long as
those logs are kept around.

## Appendix: NPM hardening checklist (reusable across projects)

For any service proxied through Nginx Proxy Manager, this is the general
shape of what "good" looks like — most of it isn't TaskTracker-specific:

1. **Real client IP end-to-end** — the app's `trust proxy` setting (or
   equivalent in another stack) has to match the actual number of proxy hops
   in front of it. One NPM hop in front of the app = trust proxy `1`. Get
   this wrong and every IP-based check downstream (rate limiters, audit
   logs) silently keys on the wrong address.
2. **App-level rate limiting on sensitive endpoints** — login, and any
   public unauthenticated input (signup/contact forms), should have their
   own precise, endpoint-specific limiter inside the app. First line of
   defense, easiest to test in isolation.
3. **Edge rate limiting in NPM** — a general `limit_req` zone as a second
   line of defense, shielding the app process from a high-volume flood
   before it even arrives. Remember `limit_req_zone` only works from
   `http_top.conf` (http context) — it silently does nothing from a
   per-host Advanced tab alone.
4. **No hardcoded/backdoor tokens** — audit any home-grown auth middleware
   for a magic-string bypass (the `demo-token` pattern found in this
   project). Real sessions should be signed, expire, and carry the actual
   authenticated user's identity — never a single fixed value.
5. **Correct status codes** — `limit_req_status 429` in nginx, and confirm
   the app's own rate limiter also returns `429` (not nginx's default
   `503`), so logs and monitoring can tell "rate limited" apart from
   "server error."
6. **Log visibility (GoAccess or similar)** — point it at each Proxy Host's
   access log with a log-format that actually matches what NPM writes, and
   use it to confirm hardening changes are having the intended effect
   rather than assuming they are.
7. **Secrets checklist** — anything like `JWT_SECRET` documented in
   `.env.example` with a generation command, never committed with a real
   value, never left on an insecure default in production.

## Roadmap / deferred (not urgent)

Evaluated but intentionally not built yet:

| Option | When it's worth it | Cost |
|---|---|---|
| Cloudflare Turnstile | Honeypot + time trap isn't enough, spam gets more sophisticated | Cloudflare account + Site/Secret key, frontend + backend changes |
| Google Workspace (OAuth) | Want to drop local passwords entirely | Google Cloud Console project + Client ID/Secret, restrict to your domain |
| Geo-IP filter in nginx (Uruguay only) | Extra network-layer barrier | Risk: can lock out the admin while traveling or on VPN/mobile data. Needs the GeoIP module + IP database. Lower payoff now that the real-token fix is in |

## Commits

1. `Add honeypot + time-trap anti-spam to onboarding form`
2. `Add discard option for pending onboarding/offboarding requests`
3. `Replace hardcoded auth bypass with real JWT sessions + login rate limit`

All pushed to `claude/tasktracker-onboarding-module-wfgnm8`.
