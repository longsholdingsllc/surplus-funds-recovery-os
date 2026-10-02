# Surplus Funds Recovery OS

Company-only case-management platform for **Long's Holdings LLC** — tracks surplus-funds recovery cases from lead identification through claimant outreach to recovery. Replaces the original 4-file static demo (browser `localStorage`, no backend) with a real production platform: Next.js 14 App Router + Supabase (Postgres + private Storage) + Vercel Cron automations.

## What it does

- **Dashboard** — pipeline totals, open/stale case counts, upcoming document/ID expiries
- **Cases** — full case workspace: linked claimants, properties, tasks, documents
- **Claimants / Properties / Tasks / Documents** — dedicated list pages
- **Document vault** — uploads stored in a private Supabase Storage bucket; downloads served via 60-second signed URLs and logged
- **Audit trail** — every mutation (web or cron) writes to `audit_log`
- **Automations (Vercel Cron, drafts-only — nothing is ever auto-sent):**
  - `followups` (daily) — creates "Follow up" tasks for cases with no activity in 7+ days
  - `doc-expiry` (daily) — creates reminder tasks for documents/claimant IDs expiring within 30 days
  - `backup-check` (weekly) — verifies DB connectivity, logs result
  - `outreach-drafts` (weekly) — drafts outreach emails as tasks for `new` cases (human sends)
  - `lead-digest` (weekly) — scrapes enabled county sources in `lib/counties.json`, inserts new leads as `status='lead'` cases (best-effort parsing, deduped)

## Setup

### 1. Supabase

Restore (or create) a Supabase project, then open the **SQL editor** and run the entire contents of `schema.sql`. It creates:

- Tables: `cases`, `claimants`, `properties`, `tasks`, `documents`, `audit_log`
- Row Level Security enabled on all tables with **no public policies** (deny by default)
- `updated_at` auto-update trigger on `cases`
- Private `case-documents` storage bucket with explicit deny-public policies

### 2. Environment variables (Vercel project settings)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Supabase anon key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS — used only in API routes/server components, never sent to the browser |
| `CRON_SECRET` | server only | If set, cron routes require `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically when the variable exists) |

### 3. Deploy

Push to the repo's `main` branch — Vercel auto-deploys. Cron schedules live in `vercel.json` (times are UTC):

| Job | Schedule (UTC) | ~US Central |
|---|---|---|
| followups | `0 12 * * *` daily | 7:00 AM CDT |
| doc-expiry | `0 13 * * *` daily | 8:00 AM CDT |
| backup-check | `0 14 * * 0` weekly Sun | 9:00 AM CDT |
| outreach-drafts | `0 15 * * 1` weekly Mon | 10:00 AM CDT |
| lead-digest | `0 16 * * 1` weekly Mon | 11:00 AM CDT |

## Adding a county source

Edit `lib/counties.json` and append an entry:

```json
{
  "county": "Example",
  "state": "IL",
  "source_url": "https://www.examplecounty.gov/treasurer/unclaimed",
  "source_type": "treasurer_surplus_list",
  "enabled": true,
  "notes": "Anything the next maintainer should know."
}
```

- `source_type`: `treasurer_surplus_list` | `tax_sale_list` | `unclaimed_funds_page`
- `enabled: false` keeps the entry without scraping it
- **Verify each `source_url` by hand** — county sites change; the seeded URLs are starting points, not verified endpoints. The digest is best-effort: it extracts dollar amounts near surplus/excess/unclaimed keywords, parcel-like tokens, and street addresses, then dedupes against existing records.

## Security posture

- **Vercel Deployment Protection (SSO login gate) is the company-only perimeter** and must stay ON. There is no app-level login by design.
- `SUPABASE_SERVICE_ROLE_KEY` never leaves the server — all data access goes through server components and API routes.
- The `case-documents` bucket is private; files are served only through short-lived signed URLs, and every download is audit-logged.
- RLS is enabled on every table with no permissive policies: direct client access to the database is denied by default.
- Outreach is **drafts-only**: the platform prepares, reminds, and drafts — a human approves and sends. Nothing auto-sends email or messages.

## Local development

```bash
npm install
# copy env vars into .env.local, then:
npm run dev
```
