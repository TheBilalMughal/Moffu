# SEO Vertical — Full Implementation Plan

## Overview

A complete website SEO audit vertical inside the customer portal. Automatically picks the website URL from the client's connected Google Business Profile location (no manual URL input). Runs Google PageSpeed Insights API for all audit data — free, no extra billing, no DataForSEO needed.

---

## Confirmed Decisions

| Decision | Value |
|---|---|
| Audit trigger | Manual (button) + Scheduled (cron) |
| AI Recommendations language | Auto-detect — matches user's browser/portal language |
| Competitor feature | V1 — included from day one |
| URL source | Auto from GBP location `website_uri` — no manual input |
| API | Google PageSpeed Insights API (free, 25k req/day) |
| Mobile + Desktop | Both — user can toggle |

---

## Where It Lives

```
Portal sidebar:
├── Overview          ← existing — Website section added here
├── Reviews           ← existing
├── Brand Brain       ← existing
├── SEO               ← NEW top-level section
│   ├── Overview      (scores + vitals + top issues)
│   ├── Issues        (full list, filterable by category + severity)
│   ├── Competitor    (compare vs competitor URL)
│   ├── History       (score chart over time)
│   └── Settings      (schedule config)
```

The portal **Overview page** gets a new "Website" card below the Google Profile card — shows last audit score, quick vitals, and a "View Full Report" link to `/seo`.

---

## Data Flow

```
1. User selects location (global topbar selector)
2. That location's website_uri is read from google_locations table
3. No URL → show "No website linked to this GBP location"
4. URL found → check if recent audit exists (within schedule window)
5. Show cached audit OR offer "Run Audit" button
6. On run: Edge Function calls PageSpeed API (mobile + desktop)
7. Results saved to DB → UI renders
```

---

## Database Schema

### Table: `seo_audits`
```sql
id               uuid PRIMARY KEY
user_id          uuid NOT NULL REFERENCES auth.users(id)
org_id           uuid NOT NULL REFERENCES organizations(id)
location_id      uuid REFERENCES google_locations(id)   -- which GBP location
website_url      text NOT NULL                           -- the URL audited
status           text NOT NULL DEFAULT 'pending'         -- pending | running | complete | failed
triggered_by     text NOT NULL DEFAULT 'manual'          -- manual | schedule
mobile_score     jsonb                                   -- full PageSpeed response (mobile)
desktop_score    jsonb                                   -- full PageSpeed response (desktop)
overall_score    int                                     -- 0-100 weighted average
created_at       timestamptz NOT NULL DEFAULT now()
completed_at     timestamptz
```

### Table: `seo_issues`
```sql
id               uuid PRIMARY KEY
audit_id         uuid NOT NULL REFERENCES seo_audits(id) ON DELETE CASCADE
device           text NOT NULL                           -- mobile | desktop
category         text NOT NULL                           -- performance | seo | accessibility | best_practices
severity         text NOT NULL                           -- critical | warning | info
audit_key        text NOT NULL                           -- PageSpeed audit id e.g. "render-blocking-resources"
title            text NOT NULL
description      text
score            numeric                                 -- 0.0-1.0 (PageSpeed score for this audit)
display_value    text                                    -- "Potential savings of 1.8s"
details          jsonb                                   -- raw items (URLs, sizes, etc.)
```

### Table: `seo_history`
```sql
id               uuid PRIMARY KEY
user_id          uuid NOT NULL
location_id      uuid NOT NULL REFERENCES google_locations(id)
website_url      text NOT NULL
recorded_at      date NOT NULL
performance      int
seo              int
accessibility    int
best_practices   int
lcp              numeric   -- ms
inp              numeric   -- ms
cls              numeric
fcp              numeric   -- ms
ttfb             numeric   -- ms
UNIQUE(location_id, recorded_at)
```

### Table: `seo_schedules`
```sql
id               uuid PRIMARY KEY
user_id          uuid NOT NULL
org_id           uuid NOT NULL
location_id      uuid NOT NULL REFERENCES google_locations(id)
frequency        text NOT NULL   -- daily | weekly | monthly
day_of_week      int             -- 0-6, for weekly (0=Sunday)
day_of_month     int             -- 1-31, for monthly
time_of_day      time            -- e.g. 09:00
enabled          boolean DEFAULT true
last_run_at      timestamptz
next_run_at      timestamptz
created_at       timestamptz DEFAULT now()
UNIQUE(location_id)             -- one schedule per location
```

### Column addition: `google_locations`
```sql
ALTER TABLE google_locations ADD COLUMN IF NOT EXISTS website_uri text;
```

---

## Edge Functions

### `run-seo-audit`
- Auth: user JWT (portal caller)
- Input: `{ location_id, device? }` — device defaults to both
- Steps:
  1. Verify user owns the location
  2. Read `website_uri` from `google_locations`
  3. Create `seo_audits` row with status `running`
  4. Call PageSpeed API for mobile: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy=mobile&key={key}`
  5. Call PageSpeed API for desktop: same with `strategy=desktop`
  6. Parse results → extract categories, audits, Core Web Vitals
  7. Insert `seo_issues` rows for all failing/warning audits
  8. Update `seo_audits` status to `complete`
  9. Upsert `seo_history` row for today
  10. Return audit id

### `run-seo-audit-scheduled`
- Auth: internal cron secret
- Input: none — reads all `seo_schedules` where `next_run_at <= now()` and `enabled = true`
- Calls same audit logic per location
- Updates `last_run_at` and `next_run_at` on schedule

### `get-seo-ai-recommendations`
- Auth: user JWT
- Input: `{ audit_id, language? }`
- Steps:
  1. Load top failing issues for this audit (sorted by score impact)
  2. Build prompt: list of issues + website context
  3. Call Gemini API
  4. Language detection: use `language` param if provided, else detect from `Accept-Language` header
  5. Return 3-5 concrete fix recommendations in that language
  6. Cache result in `seo_audits.ai_recommendations` jsonb column

---

## PageSpeed API — What We Extract

### Category Scores (0-100)
- `categories.performance.score * 100`
- `categories.seo.score * 100`
- `categories.accessibility.score * 100`
- `categories.best-practices.score * 100`

### Core Web Vitals (from `audits`)
| Field | PageSpeed key |
|---|---|
| LCP | `largest-contentful-paint` |
| INP | `interaction-to-next-paint` |
| CLS | `cumulative-layout-shift` |
| FCP | `first-contentful-paint` |
| TTFB | `server-response-time` |
| TBT | `total-blocking-time` |
| Speed Index | `speed-index` |

### Performance Audits (issues we capture)
- `render-blocking-resources`
- `unused-javascript`
- `unused-css-rules`
- `uses-optimized-images`
- `uses-webp-images`
- `uses-responsive-images`
- `offscreen-images`
- `efficient-animated-content`
- `duplicated-javascript`
- `legacy-javascript`
- `uses-text-compression`
- `uses-long-cache-ttl`
- `server-response-time`
- `redirects`
- `uses-rel-preconnect`
- `font-display`
- `total-byte-weight`
- `dom-size`
- `mainthread-work-breakdown`
- `bootup-time`

### SEO Audits
- `meta-description`
- `document-title`
- `link-text`
- `crawlable-anchors`
- `is-crawlable`
- `robots-txt`
- `image-alt`
- `hreflang`
- `canonical`
- `font-size`
- `tap-targets`
- `structured-data`
- `http-status-code`

### Accessibility Audits
- `color-contrast`
- `image-alt`
- `button-name`
- `label`
- `heading-order`
- `html-has-lang`
- `aria-*` (multiple)
- `duplicate-id-aria`
- `frame-title`

### Best Practices Audits
- `is-on-https`
- `no-vulnerable-libraries`
- `csp-xss`
- `uses-http2`
- `uses-passive-event-listeners`
- `no-document-write`
- `charset`
- `deprecations`
- `errors-in-console`
- `image-aspect-ratio`
- `image-size-responsive`

---

## Portal UI — Page by Page

### Overview Page — Website Card (new section)
```
[ Website: mybusiness.com ]
Last audit: 2 days ago  |  Schedule: Weekly

Performance  SEO    Accessibility  Best Practices
   74         82        91              78
   📉 -3      📈 +5     —              📉 -2

[ View Full Report ]  [ Run Audit Now ]
```

### SEO Overview (`/seo`)
- 4 large score circles with color (green ≥90, amber 50-89, red <50)
- Mobile / Desktop toggle (affects all data below)
- Core Web Vitals row — LCP / INP / CLS with PASS/FAIL badge and actual value
- Secondary metrics — FCP, TTFB, TBT, Speed Index
- Top 5 Critical Issues (quick view)
- AI Recommendations panel (3-5 items, language auto-detected)
- Last audit time + "Run Audit" button
- Schedule status chip

### SEO Issues (`/seo/issues`)
- Filter bar: Category (All / Performance / SEO / Accessibility / Best Practices) + Severity (All / Critical / Warning / Info) + Device (Mobile / Desktop)
- Table: Severity icon | Issue title | Category | Impact score | Display value (savings)
- Click row → expand details (affected URLs, sizes, element screenshots from PageSpeed)
- Summary counts: X critical, Y warnings, Z info

### Competitor (`/seo/competitor`)
- Single URL input field (manual — this is the only place manual URL exists)
- "Compare" button
- Side-by-side: My Site vs Competitor
- Same 4 score cards, Core Web Vitals, top issues
- "Their advantage" / "Your advantage" badges
- No history saved for competitor (one-time comparison)
- Competitor results cached for 24h (same URL hit again → use cache)

### History (`/seo/history`)
- Line chart: Performance / SEO / Accessibility / Best Practices over time
- Each data point = one audit (manual or scheduled)
- Hover → show exact scores + date
- Core Web Vitals trend below (LCP, INP, CLS separate lines)
- Audit log table: date | triggered by | overall score | view report link

### Settings (`/seo/settings`)
- Schedule section:
  - Enable/disable toggle
  - Frequency: Daily / Weekly / Monthly (custom Dropdown)
  - Day (for weekly/monthly)
  - Time of day
  - Next run preview: "Next audit: Monday 9:00 AM"
  - Save button
- Website info section (read-only): shows URL pulled from GBP, link to GBP settings if needs updating

---

## Severity Classification Logic

```
critical  → audit.score < 0.5  (failing, red)
warning   → audit.score >= 0.5 && < 0.9  (needs improvement, amber)
info      → audit.score >= 0.9  (passed but informational, gray)
skip      → audit.scoreDisplayMode === 'notApplicable' | 'manual' | 'informative'
```

---

## AI Recommendations Prompt Structure

```
System: You are an SEO expert. Give concrete, actionable fixes.
        Respond in {detected_language}. Be direct, no fluff.

User: Website: {url}
      Performance: {score}/100, SEO: {score}/100

      Top failing issues:
      1. {title} — {description} — Potential saving: {display_value}
      2. ...
      3. ...

      Give exactly 3-5 recommendations. Each must have:
      - What to fix (1 sentence)
      - How to fix it (1-2 sentences, technical but understandable)
      - Expected impact (e.g. "+8-12 performance points")
```

---

## RLS Policies

```sql
-- seo_audits: user sees only their own
CREATE POLICY "user_own_audits" ON seo_audits FOR ALL
  USING (user_id = auth.uid());

-- seo_issues: via audit ownership
CREATE POLICY "user_own_issues" ON seo_issues FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM seo_audits WHERE id = seo_issues.audit_id AND user_id = auth.uid()
  ));

-- seo_history: user sees only their own
CREATE POLICY "user_own_history" ON seo_history FOR ALL
  USING (user_id = auth.uid());

-- seo_schedules: user sees only their own
CREATE POLICY "user_own_schedules" ON seo_schedules FOR ALL
  USING (user_id = auth.uid());
```

---

## Environment Variables Needed

| Variable | Where | Value |
|---|---|---|
| `PAGESPEED_API_KEY` | Supabase Edge Function secret | Google Cloud Console → PageSpeed Insights API key |
| Already have `GEMINI_API_KEY` | Supabase Edge Function secret | Used for AI recommendations |

PageSpeed API works without a key (anonymous) but is rate-limited to ~2 req/sec. With a free API key: 25,000 req/day.

---

## Migration Files Plan

```
20261118000005_google_locations_website_uri.sql   -- add website_uri column
20261118000006_seo_tables.sql                     -- seo_audits, seo_issues, seo_history, seo_schedules + RLS
```

---

## Implementation Order

1. **Migration** — `website_uri` on `google_locations` + all SEO tables
2. **GBP sync update** — save `websiteUri` from GBP API response during location sync
3. **Edge Function: `run-seo-audit`** — calls PageSpeed, parses, saves to DB
4. **Portal: Overview page** — Website card (score + vitals + link)
5. **Portal: `/seo` Overview** — full scores, vitals, top issues, AI recs
6. **Portal: `/seo/issues`** — full issues list with filters
7. **Portal: `/seo/competitor`** — comparison tool
8. **Portal: `/seo/history`** — trend chart
9. **Portal: `/seo/settings`** — schedule config
10. **Edge Function: `run-seo-audit-scheduled`** — cron-triggered batch runner
11. **pg_cron job** — trigger scheduled audits every hour, check `next_run_at`

---

## Status

**PLANNED** — not started. Awaiting implementation go-ahead.
