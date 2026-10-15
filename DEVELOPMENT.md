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
