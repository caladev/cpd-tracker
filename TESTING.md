# Regression testing

Run `npm ci` with Node 26, then `npm run check`. This runs unit tests,
JSDOM component interaction tests, HTTP integration tests against isolated
temporary storage, coverage enforcement, and the Vite production build.
No running app or access to the shared database is required.

## Coverage review

The initial review on 13 September 2026 found 57 passing tests with 59.38%
line coverage. Most calculations already had tests, but modal interactions,
evidence, export controls, and HTTP routes lacked direct coverage.

After expansion: 85 passing tests across 10 files; 95.40% statements/lines,
80.41% branches, and 83.24% functions. These are measured results for this
revision, not a claim of exhaustive behavioral or visual coverage.

The expanded suite covers the following:

| Area | Regression checks |
| --- | --- |
| Date and CPD rules | July/June boundaries, triennium selection, future years, Actual/Draft totals, ethics, verifiable/OJT caps, pro-rata exemptions |
| Entry lifecycle | Create, edit, promote, confirmed deletion, field validation, rounding, derived FY/triennium, cancellation |
| Evidence | File/link removal must not submit or close the entry; uploads append evidence and show errors; entry deletion cleans up references |
| Dashboard | Australian long dates, undated fallback, Actual/Draft labels, recent activity editing |
| Navigation | Every page reachable, active state, keyboard operation, stylesheet regression for the hidden mobile menu |
| Administration | Rules editing and deletion protection, exemption editing, triennium creation/duplicates, reset confirmation |
| API client | JSON/multipart requests, encoded file paths, server error and non-JSON failure handling |
| HTTP server | Data persistence and validation, upload/read/delete, rejected paths/uploads, storage info |
| Reports | Scope selection and current-period defaults, summary aggregation, CSV escaping, evidence option |
| ZIP | Decode the actual archive; selected-period files only, flat evidence directory, collision suffixes, matching report references |

HTML details are generated in `coverage/index.html` and totals in
`coverage/coverage-summary.json`. Minimums are enforced in `vite.config.js`:
95% statements/lines, 80% branches, 83% functions. New untested application
files are included in coverage. Exclusions are tests, SVG icon markup, the
React mount entrypoint, and the platform-specific process-stop script.

## Limits and isolation

Coverage measures execution, not proof that every behavior is correct. Some
defensive branches, low-level filesystem/stream failures, and UI control
variations remain uncovered; use the HTML report when changing those areas.
JSDOM has no layout engine: mobile CSS checks guard the original hiding bug
but cannot prove visual layout or touch usability. Real browser downloads,
network access from a phone, and iCloud/macOS permissions remain manual checks.

HTTP tests set `CPD_DATA_DIR` to a new temporary directory before importing
the server. Vitest's test environment suppresses its normal listener;
Supertest creates temporary HTTP listeners for tests. These tests never
start or stop the normal app and never write to its shared iCloud data.
In restricted environments, permission to bind a local test port is needed.

GitHub Actions runs the same check on main pushes and pull requests. Keep
the suite deterministic, add regression cases for future fixes, and do not
reduce coverage minimums to accommodate untested features.
