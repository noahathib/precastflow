# Deployment

## Hosted shared edition

The source is published to GitHub. The main shared site is a Cloudflare-compatible Worker deployed through Sites with a managed D1 binding named `DB`. The `.openai/hosting.json` file identifies this Site and declares that logical binding. Hosting supplies the actual database ID and applies the migrations in `drizzle/`.

For this Site, preserve its identity, push the exact source revision, build the Worker and save/deploy that version through Sites. Do not place credentials in `.openai/hosting.json` or source control. A generic Cloudflare deployment can use the same Worker output with its own D1 binding and migrations, but needs independently provisioned hosting configuration.

The public shared edition deliberately opens in **local demonstration** until the visitor starts or joins a shared room. It does not expose a common global mutable demo database. Each visitor's new room starts with a fresh fictional dataset.

Production authentication is optional and separate. Configure the three server-only variables in `.env.example`, provision verified accounts with Supabase, and verify sign-in/plant membership on a non-public production deployment before real use. No database service-role key is needed. The source does not contain production credentials.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. Set repository **Settings → Pages → Source → GitHub Actions**. Push to `main` or run the workflow manually. It uses Node 24, installs locked dependencies, type-checks, runs workflow tests, builds the static application and uploads `pages-dist`.

The Pages build is deliberately browser-local. It cannot host `app/api/flow`; connected demonstration actions link to the shared HTTPS site instead. It always uses hash routes, and `PAGES_BASE=/<repository-name>/` sets the asset prefix. The generated QR preserves `location.pathname`, so links retain `/precastflow/` under a project-page deployment.

The Pages edition opens with a simple demo password gate. An unlock is remembered in `sessionStorage` for the current tab, and existing hash/QR destinations are preserved after entry. The gate is mounted only by `client.tsx`, so it does not change the shared edition. Its password digest and access flag are client-side and bypassable; this is a convenience barrier for the public fictional demo, not protection for confidential content. To change the demo password, replace `PASSWORD_DIGEST` in `components/flow/demo-gate.tsx` with its SHA-256 digest and redeploy.

For a custom domain/root deployment use `PAGES_BASE=/ npm run build:pages` and update the shared-site link constant as appropriate.

## Security boundary

Production requests carry a Supabase access token. The Worker verifies the token remotely, requires a confirmed email and plant membership, derives the role on the server, and applies the same command validator used by the local demo. Demo requests use separate opaque sessions tied to `demo-<UUID>` rooms; the join endpoint explicitly rejects `production` as a room. No demo role selection can grant a production role.

Concurrent workspace changes are committed with an atomic version condition. The losing writer receives HTTP 409. The client refreshes and asks the user to review and submit again. A successful command retry with the same ID and payload returns its recorded state without adding another event. Reusing a key for another payload is rejected.

Workspace state, records and membership tables are not exposed through a public database API. The Worker routes are the enforcement boundary; D1 is server-only. A production PostgreSQL port would need equivalent transactional validation and membership policies rather than direct unrestricted client writes.
