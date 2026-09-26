# PrecastFlow

**From Shop Drawing to Jobsite.** A working precast production tracking demonstration with serialized QR passports, role-based activities, quality holds, batch traceability, yard inventory, shipments and receiving.

- **Shared demonstration:** https://precastflow-production.clear-tick-3522.chatgpt.site
- **GitHub Pages, browser-local edition:** https://noahathib.github.io/precastflow/
- **Source:** https://github.com/noahathib/precastflow

## Start the demonstration

Open the shared site and choose **Start shared demo → Administrator → Start shared demonstration**. This creates an isolated fictional workspace. No password is required or checked for demo roles. Eight simulated roles are available through the account button.

The initial browser-local mode works without a database. It saves to the current browser only. Choose a **shared** workspace before a phone demonstration: use **Copy workspace link** or a generated element QR to join the same room on another device. New devices join as a simulated Production Technician and can select another demo role. Anyone with that room link can use simulated roles; never place confidential or real production data in a demo room.

48 independently serialized elements across three fictional projects demonstrate engineering, forming, pre-pour QC, placement, curing, strength release, stripping, post-pour QC, repair, yard, shipping and receipt. All dashboards and reports derive from the workspace's recorded data.

## Guided presentation

1. Create a project. Its project dashboard opens automatically.
2. Add three pieces with mark `P-101`; they receive separate serials and immutable IDs.
3. Open one passport, release engineering, and record verified formwork readiness.
4. Open **Production label**. Print the QR label or download PNG/SVG.
5. Scan with a phone camera, or use **Scan QR** and grant camera access. Enter a serial or paste the passport URL if the camera is unavailable.
6. Select QC Technician; complete the pre-pour checks and approve. Production roles cannot approve QC.
7. Select Production Technician; record mix, batch ticket, placement times and concrete test data. A shared batch ticket links multiple pieces. SCC uses slump flow.
8. QC records release-strength evidence; only then can production record stripping.
9. QC records a defect. Production documents the approved repair procedure/materials. The hold remains until QC Manager reinspection accepts every outstanding defect.
10. Record final QC and shipping-strength evidence; assign the yard location.
11. Shipping creates a shipment, selects accepted pieces, confirms loading, records departure, and prints a manifest/PDF.
12. Receiving confirms individual pieces or the outstanding elements of a shipment. Receipt does not imply installation.
13. Review the passport history and export a traceability report. Other connected screens refresh every five seconds.

**Administration → Reset demonstration data** resets only the selected demo room or local browser, after confirmation. Export the workspace first if you want to retain presentation records.

## Run locally

Requires Node.js 24 (Node 22.18+ also supports the test runner) and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_organic_gwen_stacy.sql
npm run dev
```

Open the URL printed by the development server. Apply the migration only once to a local database. Preview data stays under ignored `.wrangler/`. If desired, `npm start` previews the built Worker instead of the development server.

To verify the shared backend with the development server running:

```sh
node tests/api.test.mjs
```

That test creates disposable fictional rooms and checks role enforcement, cross-user reads, room isolation, idempotency, malformed inputs and concurrent writes. `FLOW_TEST_URL` overrides its default localhost endpoint.

## Architecture

- React 19, TypeScript, Tailwind CSS, styled Shadcn primitives, Lucide icons.
- Vinext/Vite frontend and Cloudflare Worker API.
- Managed Cloudflare D1 persistence for shared workspaces, sessions and plant membership. SQLite schema/migration lives in `db/` and `drizzle/`. This implementation uses D1 rather than PostgreSQL.
- One versioned JSON aggregate per workspace keeps events, holds and operational state in a single atomic compare-and-swap update. Concurrent writers get a conflict and must review refreshed data.
- `lib/model.ts` contains the common validated command handler. Server timestamps and session-derived actors are authoritative in connected mode. The client never chooses production membership or directly writes a stage.
- `qrcode` generates labels; `@zxing/browser` decodes camera QR images locally.
- Hash routing preserves stable element URLs under GitHub Pages project subpaths. Element URLs retain immutable IDs, and shared demo URLs also include the workspace identifier.
- Original events are retained. Corrections append an event referencing the original; repairs and QC release have separate records. Command IDs are bound to payloads to prevent contradictory retries.

See [Workflow research](docs/WORKFLOW_RESEARCH.md), [Deployment](docs/DEPLOYMENT.md), and [Verification](docs/VERIFICATION.md).

## Optional production email/password sign-in

**The published demonstration does not include a configured production identity provider.** There is no hardcoded production password list. A production sign-in attempt explains the missing configuration.

For a separate plant deployment, create/use a Supabase project, enable email/password authentication and verified accounts, then set the server runtime variables in `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PRODUCTION_ADMIN_EMAIL`. Add local values in ignored `.dev.vars` for Wrangler if needed. Set hosted values through the hosting environment configuration. Never put privileged credentials in the browser or commit them.

The API exchanges credentials with Supabase's password endpoint and verifies the returned access token against `/auth/v1/user` on each request. Verified users are authorized by the plant membership table. The configured administrator is bootstrapped at first sign-in and can add verified user emails with roles in Administration. Other verified accounts have no access until added. The production workspace starts empty and is inaccessible to demo sessions. No Supabase service-role key is used. Supabase authenticates; D1 stores plant records.

Production identity configuration and live email/password sign-in need verification against your own Supabase project. The demo test suite does not claim to test that external configuration.

## Exports

Project production, daily activity, QC holds, element traceability and shipping reports support CSV and print/PDF. **Print / PDF → Save as PDF** uses the browser print dialog. The same applies to shipment manifests. Labels can be printed in batches; QR images download as PNG or SVG. CSV values are escaped against spreadsheet formula injection. Complete workspace JSON export includes histories and embedded photos.

## Known limitations

- This is a demonstration foundation, not a certified manufacturing execution system or a substitute for a documented plant quality program.
- Public shared demos use simulated identities; the room link is a bearer invitation to fictional records. Sessions last seven days. No production confidentiality is implied by a demo room.
- GitHub Pages has no application backend. Its local edition keeps records in that browser and links to the shared site. It does not share newly created pieces across devices.
- Supabase production sign-in must be configured separately. The current plant membership model supports one production plant per deployment. Session expiration asks the user to sign in again; automatic refresh and password recovery UI are not included.
- D1 workspace aggregates are appropriate for demonstrations and modest workloads, not high-volume multi-plant production. The app caps a workspace at approximately 3,000 pieces / 15,000 events; inline photos consume that storage sooner. Use object storage and normalized tables before commercial scaling.
- Photos accept JPG, PNG or WebP source files up to 3 MB and compress them to a maximum 350 KB data URL. Each demo aggregate is capped at 1.8 MB. Photos are stored with records rather than a managed document revision repository. Drawings are references, not uploaded CAD/PDF files.
- Only the separate formwork readiness activity is configurable in the current UI. Supporting curing logs are repeatable; safety-relevant QC, strength and shipment gates remain required. Fully arbitrary workflow design is not implemented.
- Placement records currently assume same-day start/completion times. Times, observations, test reports and dimensional values support recording; engineering acceptance limits remain the plant's responsibility.
- Board cards open validated actions; drag-and-drop transitions are intentionally not implemented.
- Camera hardware and actual printed-label scanning must be checked on the presentation phone. Camera denial falls back to manual lookup. Localhost cannot be scanned from another device; use the published HTTPS site.
- No retention policy, automated backups, SSO, bulk ERP import, or external lab/test integration is included. Live production use requires a security/operations review and appropriate backup/retention setup.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local application + API |
| `npm run build` | Cloudflare-compatible Worker build |
| `npm start` | Preview built Worker |
| `npm run build:pages` | Static browser-local edition |
| `npm run typecheck` | TypeScript verification |
| `npm test` | Workflow/integrity tests |
| `node tests/api.test.mjs` | Running API tests |
| `npm run db:generate` | Generate migrations after schema edits |

The provided GitHub Actions workflow verifies types/tests and publishes the static edition. Source and dependency licenses remain with their respective authors.
