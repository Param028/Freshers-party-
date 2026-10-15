# Development and secrets

## Local development

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env` and replace the placeholders with the existing Supabase project URL, its service-role key, and an organizer password. The service-role key and password must remain local and must never be committed or included in browser code.
3. Run `npm start` to serve the site and API on port `3000` (or the `PORT` value supplied by the environment).
4. Open `/` for registration and `/admin` for the organizer login. `/api/health` reports only whether the required server values are configured; it never returns their values.

The repository ignores `.env` and `.env.*`, while explicitly allowing the safe `.env.example` template. Keep actual values only in an untracked local `.env` or an approved secret manager.

## Managed development and production

The managed project reads `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` from its protected environment configuration. They are server-only variables, are not bundled into the page, and must be entered or replaced only through the managed secret-input flow. Development and production secret scopes are independent: configure each environment explicitly when different values are required. Do not paste values into source files, migration files, logs, task notes, or version control.

`SUPABASE_URL` is the public project endpoint and is set to the existing `freshers-party-registrations` project by the server default; it may also be supplied through the local environment. The committed `.env.example` uses placeholders for privileged values and is safe to share.

## Organizer-managed crew contacts

The current public “Ping the crew” list is stored in the RLS-enabled Supabase `public.event_contacts` table. Only the server-side service role can access this table, and all list/add/edit/remove operations are exposed through `/api/admin/event-contacts` with the organizer session required. Public visitors receive only the contact fields needed to render Call and WhatsApp links through `/api/event-contacts`. Manage the list from the protected `/admin` dashboard; do not add contact details or credentials to source files.


Contact phone input is normalized by the shared `contact-phone.js` module used by both the server and admin UI; only supported, bounded formats are accepted, and records are stored as E.164 numbers. The database normalizer is restricted to trusted roles and the contact table constraint enforces canonical values. The dated migrations in `supabase/migrations/` preserve unsupported legacy values and abort rather than silently deleting or rewriting them.


## Vercel deployment

GitHub `main` pushes trigger the connected Vercel deployment. `vercel.json` publishes the `dist/` static output, maps `/admin` to the admin page, and the `api/[...path].js` function routes `/api/...` requests through the shared `server.js` handler. The function also supports Vercel's pre-parsed JSON request bodies.

Vercel runtime secrets are separate from Manus-managed project secrets. In the Vercel project settings, configure `ADMIN_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` for Production (and Preview if those deployments need organizer/data access); `SUPABASE_URL` can be set there to override the existing project default. Keep all values in Vercel's protected Environment Variables, never in this repository. Check `/api/health` for a JSON response with configuration booleans; it never returns secret values.
