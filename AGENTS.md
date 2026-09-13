# Agent Notes

## Running The App

- Always start the app with `npm run dev:fresh` from the worktree you are using.
- `npm run dev:fresh` first stops any process listening on ports `39889` or `39890` (and clears legacy `5173`/`5174` processes), then starts the API and Vite dev server.
- Do not leave old worktree instances running. Vite and the API use fixed ports, and a UI from one worktree can otherwise talk to an API from another worktree.

## Shared Data Store

- The app data is shared across worktrees through this default absolute path:
  `/Users/michael/Library/Mobile Documents/com~apple~CloudDocs/Docs/CA/cpd-tracker-app-data`
- The API logs the data directory on startup. Verify with `curl http://localhost:39890/api/info` if the app looks empty or stale.
- Only use `CPD_DATA_DIR` when intentionally testing against a separate data directory. Unset it for normal local use so every worktree reads the shared iCloud DB and evidence files.

## Ports

- UI: `http://localhost:39889`
- API: `http://localhost:39890`
- Vite uses `strictPort: true`, so startup should fail instead of silently moving to another port.

## Regression Tests Required For Future Changes

- Run `npm run check` before committing/pushing feature changes or bug fixes. This runs the complete Vitest suite with coverage thresholds, then the production build. All checks must pass.
- Use `npm test` for quick regression runs and `npm run test:coverage` for the report. HTML coverage is generated at `coverage/index.html`; machine-readable totals are in `coverage/coverage-summary.json`. Generated coverage files must not be committed.
- Maintain the enforced minimums in `vite.config.js`: 95% statements/lines, 80% branches, and 83% functions. Review changed-file coverage, not just the aggregate. Add meaningful tests instead of lowering thresholds or excluding application behavior to make a check pass.
- Every new feature needs tests for its behavior and relevant failure/boundary cases. Every bug fix needs a regression test that fails for the original bug. Prefer observable results and user interactions over implementation snapshots.
- Preserve coverage of entry creation/editing/validation, Actual/Draft promotion, deletion confirmation, evidence upload/removal, Australian dates, recent activity, filters, navigation/keyboard access, rules, exemptions, settings, API errors/persistence, scoped reports, and flattened ZIP evidence with duplicate names.
- API tests must set `CPD_DATA_DIR` to a unique temporary directory **before importing the server**, and remove only that directory afterward. Never run mutation tests against the shared iCloud database or evidence. UI tests mock the API; HTTP tests use temporary listeners rather than the running app's ports. If the sandbox blocks local listeners, rerun the test command with the required execution permission; do not skip those tests.
- Mock external requests and reset mocks/time between tests. Assert actual CSV and ZIP contents, not only HTTP success or archive filenames.
- Unit/component tests do not verify actual mobile rendering, browser downloads, macOS/iCloud access, or reachability from a phone. The user prefers to manually verify the UI; leave browser visual checks to them unless requested.
- GitHub Actions runs the same `npm run check` on pushes and pull requests to `main`. See `TESTING.md` for the coverage inventory and limits.
