# Onboarding/Offboarding Import (NAS reports, etc.)

TaskTracker Pro can ingest onboarding/offboarding requests from another
system on the same host - one that has no notion of our clients/projects
and no human "manager" submitting a request through the public form (for
example, a NAS/file-share access audit tool that periodically lists
accounts pending cleanup).

Instead of a network endpoint, the other system drops a JSON report file
into a folder shared with the TaskTracker container via a Docker bind
mount. TaskTracker checks that folder once a day and turns each pending
action into a normal onboarding/offboarding request, which then flows
through the regular admin panel (checklist, "Enviar actualización", final
confirmation) exactly like a manually-submitted one.

## What to mount

Both containers need the **same host folder** bind-mounted, since that's
how the file gets from one to the other. TaskTracker's side is already
wired up in `docker-compose.yml`:

```yaml
volumes:
  - ${ONBOARDING_IMPORT_HOST_DIR:-/srv/shared/onboarding-import}:/app/import
```

On the other system's `docker-compose.yml` (or `docker run -v ...`), mount
that **same host path** to wherever that system writes its report from,
e.g.:

```yaml
volumes:
  - /srv/shared/onboarding-import:/wherever/that/system/writes/reports
```

Set `ONBOARDING_IMPORT_HOST_DIR` in TaskTracker's `.env` if you don't want
the default `/srv/shared/onboarding-import` path. If you leave it unset,
TaskTracker still mounts the default path - so create it once
(`mkdir -p /srv/shared/onboarding-import` on the host) and both sides are
good to go. If the folder doesn't exist, TaskTracker just does nothing
each day - no error, no crash.

## Report JSON shape

One file per report, dropped anywhere directly inside the shared folder
(not in `processed/` or `failed/` - see below):

```json
{
  "generated_at": "2026-08-05T14:00:00Z",
  "service": "NAS Sistemaris",
  "client": "Sistemaris SRL",
  "reviewed_at": "2026-08-05T13:45:00Z",
  "pending_actions": [
    { "user": "jperez", "action": "eliminar", "note": "Ya no trabaja en la empresa" },
    { "user": "mgarcia", "action": "cambiar", "note": "Cambiar a solo lectura" }
  ]
}
```

- `service` - free text, shown as a badge on the request in the admin panel
  (e.g. "NAS Sistemaris") and included in the request's notes.
- `client` - must match a TaskTracker client name **exactly**, aside from
  case and leading/trailing whitespace (`"Sistemaris SRL"` and
  `"  sistemaris srl  "` both match; `"Sistemaris S.R.L."` does not). Copy
  the name from the Clients page, don't guess.
- `pending_actions` - one entry per user/action. Each becomes its own
  onboarding_requests row, type `alta` (both "eliminar" and "cambiar" go in
  as `alta` - the distinction lives in `action`/`note`, not the type).
  `user` and `action` are required per entry; `note` is optional.
- `generated_at` / `reviewed_at` - optional, just included in the request's
  notes for context.

## Client setup

Each client referenced by a report needs an **email set on their
TaskTracker record** (Clients page → edit → Email field) - that's the "to"
address for every email the request generates (checklist confirmations,
progress updates, the final "proceso finalizado"). No email on file = the
report fails to import for that client (see Failure handling below).

A client only has one email field. If a client has multiple contacts who
should be notified, pick one as primary for now - there's currently no
built-in way to auto-CC a second person for import-sourced requests.

## Schedule

Runs once a day at **12:00 local time** by default. Controlled by:

- `TZ` (default `America/Montevideo`) - what "local" means.
- `ONBOARDING_IMPORT_HOUR` (default `12`) - the hour (24h) it runs at.

The scheduled time is recalculated after every run (not a fixed 24h
interval from boot), so changing either env var takes effect on the next
container restart without drifting.

## File handling (idempotency)

After each daily check:

- Successfully imported files move to `<shared-folder>/processed/`.
- Files that failed (bad JSON, no matching client, matched client has no
  email, no valid `pending_actions`) move to `<shared-folder>/failed/`
  instead - they are **not** retried automatically. Check the container
  logs for the specific reason (`docker compose logs tasktracker | grep
  "Onboarding Import"`), fix the report or the client record, and drop a
  corrected copy of the file back into the shared folder (not `failed/`
  itself - that folder is never re-scanned).
- Either way, a file is only ever picked up once - moving it out of the
  top-level folder is what prevents re-importing on the next day's check.

No "recibimos tu solicitud" acknowledgment email is sent for imported
requests, since there's no person who submitted anything to acknowledge -
they go straight into "Pendientes" for you to process normally, and the
client only hears from TaskTracker once you actually work the request
(checklist items, manual updates, or final confirmation).

## Relevant environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ONBOARDING_IMPORT_HOST_DIR` | `/srv/shared/onboarding-import` | Host folder bind-mounted into the container (set in `.env`, used by `docker-compose.yml`) |
| `ONBOARDING_IMPORT_DIR` | `/app/import` | Path *inside* the container where that folder is mounted - only change this if you edit the docker-compose mount target too |
| `ONBOARDING_IMPORT_HOUR` | `12` | Local hour (24h) the daily check runs at |
| `TZ` | `America/Montevideo` | Container timezone, defines what "local hour" means |

## Where this lives in code

- `server/index.js` - search for "Inbound onboarding/offboarding report
  import" for the full implementation (file scanning, client matching,
  request creation, scheduling).
- `onboarding_requests.source` column - set to `import:<service>` for
  requests created this way, distinguishing them from manually-submitted
  ones. Shown as a badge in `src/components/OnboardingAdminPanel.tsx`.
