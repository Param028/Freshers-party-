# Freshers Party Registration — Delivery Outcomes

## [x] Mobile-first comic event page
- Keep the single scrolling page with sticky top nav, hero, about, Mr & Miss Freshers, performance signup, timeline/rules, FAQ, contact and footer sections.
- The experience is primarily for college students on mobile devices and retains the comic-book / pop-art style with thick outlines, hard offset shadows, halftone texture, speech bubbles, burst badges, comic panels and sound-effect copy.
- Preserve accessible controls, reduced-motion behavior and responsive layouts without horizontal scrolling.

## [x] Data Science Department event details
- The Freshers Party is clearly identified as a Data Science Department event across the event page; the performance branch option and server-side lead check are limited to Data Science.
- The event date is Thursday, 22 October 2026 in the hero, countdown and timeline. Registration closes when the event begins at 5:00 PM; remaining schedule details are labelled “To be announced” rather than retaining stale November dates.
- The location is labelled “To be announced” by default and refreshes from the saved server setting.

## [x] Mr & Miss Freshers registration
- Only second-year students are eligible. The visible form collects only full name, roll number, category (Mr Freshers / Miss Freshers), year (fixed to `2nd year`), phone number and consent; it does not request branch, email, social handle, talent or extra details. The hidden honeypot is not visible to students.
- Preserve accessible labels, mobile tap targets, inline validation, retry with entered values retained, honeypot spam protection, disabled sending state, safe success summary and friendly failure state.
- Submit through the server-side API to Supabase `public.contestant_registrations`.

## [x] Performance signup
- Collect performance/group name, lead name, phone, member count (1–15), member names when required, performance category, duration (1–5 minutes), optional description (up to 200 characters), equipment needs, lead branch/year and consent.
- Require all member names when member count is greater than one. Restrict the branch option and server-side accepted lead branch/year to Data Science / 1st year.
- Submit through the server-side API to Supabase `public.performance_registrations`.

## [x] Prominent registration actions
- “Register for Mr & Miss” and “Sign up for cultural program” are high-contrast primary actions displayed beside each other at desktop and mobile widths; the compact mobile action bar and no-JavaScript fallback use matching cultural-program wording.
- Both have generous tap targets and clear focus/hover states. A 375×812 Preview capture confirmed they are fully visible above the fixed mobile action bar.

## [x] Admin location control
- Preserve the currently working organizer login and password configuration without rotation; the existing login still succeeds.
- The authenticated `/admin` dashboard now has an event-location input and Save button. A private Supabase settings row persists the location; public pages display the saved venue, with “TO BE ANNOUNCED” as the current default.
- Only authenticated admin requests can read or update settings. Unauthenticated settings reads return 401; blank location updates return 400. The public read and authenticated admin read both return the default.
- Preview login remains `HttpOnly`, `Secure` and `SameSite=None`. No actual venue value was supplied, so no real location update was written to the shared live database.

## [x] Admin-managed crew contacts
- The public “Ping the crew” section displays the saved organizer contact list, including each person's name, role, phone number, Call link and WhatsApp link; keep the event's Instagram link unchanged.
- In the login-protected `/admin` dashboard, organizers can add a person and edit or remove existing contacts. Each contact has a name, role and phone number, with validated input and clear save/delete feedback. One shared browser/server phone helper enforces the raw 25-character limit, accepts only explicit single-separator formats, normalizes Indian 10-digit mobile numbers to `+91`, and stores international entries in E.164 format.
- Persist the contact list in the RLS-enabled Supabase `public.event_contacts` table, seeded with the two existing public contacts, and expose it to the public only through the server. Require admin authentication for every contact-management API operation.
- Local and stable Preview checks: public and authenticated list reads return two contacts; unauthenticated admin access returns 401; malformed phone and null JSON payloads return 400. Read-only SQL checks confirm the database helper matches the shared format rules. The real database was not modified to test a valid add/edit/delete operation.
- Do not modify contestant or performance registrations while adding this feature.

## [x] Existing admin dashboard and data protection
- Preserve search, status filtering, refresh, CSV export, call/WhatsApp actions, registration status updates (`new`, `shortlisted`, `confirmed`, `rejected`) and organizer notes.
- Keep the Supabase service-role key server-only and protect registration reads and updates behind organizer authentication.
- The existing contestant and performance tables have RLS enabled. Validation made no registration writes or changes to existing registration records.

## [ ] Vercel production API routing
- Serve `/` and `/admin` from the production static output, and route `/api/...` to the shared Node handler as a Vercel serverless function so registration, admin login and contact management work on the deployed site.
- Preserve server credentials only in Vercel's protected runtime environment; do not add them to Git or the static build. Verify deployment health/API responses are JSON rather than static-page fallback HTML.

## [x] Schema, route, runtime and handoff
- `GET /manus-routes.json` returns `/` and `/admin`; root, public and production-build manifests are synchronized and Preview returned HTTP 200.
- The event-location and crew-contact migrations are stored under `supabase/migrations/` and applied to the existing Supabase project. `event_settings` and `event_contacts` are RLS-enabled; the private database normalizer trims only ordinary spaces, rejects mixed formats/overlength input, and preserves unsupported legacy rows rather than silently rewriting them. Registration tables were not altered by these migrations.
- `.env` and local secret paths are ignored while the placeholder-only `.env.example` remains trackable.
- Node and inline admin JavaScript syntax checks, JSON checks, production build and `git diff --check` pass. Dockerfile includes the shared helper; a container build could not be run because the Docker CLI is unavailable in this sandbox. No registration test records were inserted or modified.
- No new password or Supabase credential was written to source, documentation or Git. Auto-publish remains disabled.
