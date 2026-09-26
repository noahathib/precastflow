# Verification

Verified during initial build on September 26, 2026:

- TypeScript compilation and Cloudflare-compatible Worker build.
- Static GitHub Pages build with `/precastflow/` asset base and hash routing.
- Workflow test: 48 unique seeded IDs; three independent serialized pieces; required stage transitions; technician/QC permissions; form dimensions; no stripping before strength verification; insufficient release/shipping strength rejected; defect blocks progression; repair retains hold; QC Manager-only release; shipping gates; individual receipt updates shipment status; immutable correction; idempotent retry; conflicting key payload rejected; malformed object input rejected.
- Running API test: separate demo sessions access the same room; unauthorized role cannot approve QC; subsequent user sees the approved stage; concurrent writes produce one success and one conflict; idempotent replays add no events; forged session and production-room join rejected; independent rooms retain independent records.
- Browser UI: shared-room connection; project creation opens its dashboard; three pieces created from one mark; passport and QR display; responsive layout checks.

Production Supabase sign-in is not configured in the demonstration and has not been tested against a live identity project. Physical phone camera access, printed label scanning and a real printer require hardware validation. CSV and PDF use the user's browser download/print environment.

Run `npm test` for workflow tests; run `node tests/api.test.mjs` against the running local API for backend checks. These API tests create isolated fictional rooms and do not access production data.
