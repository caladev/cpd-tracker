# Agent Notes

## Running The App

- Always start the app with `npm run dev:fresh` from the worktree you are using.
- `npm run dev:fresh` first stops any process listening on ports `39889` or `39890` (and clears legacy `5173`/`5174` processes), then starts the API and Vite dev server.
- Do not leave old worktree instances running. Vite and the API use fixed ports, and a UI from one worktree can otherwise talk to an API from another worktree.

## Shared Data Store

- The app data is shared across worktrees through this default absolute path:
  `/Users/michael/Library/Mobile Documents/com~apple~CloudDocs/Docs/CA/cpd-tracker-app-data`
- The API logs the data directory on startup. Verify with `curl http://localhost:5174/api/info` if the app looks empty or stale.
- Only use `CPD_DATA_DIR` when intentionally testing against a separate data directory. Unset it for normal local use so every worktree reads the shared iCloud DB and evidence files.

## Ports

- UI: `http://localhost:39889`
- API: `http://localhost:39890`
- Vite uses `strictPort: true`, so startup should fail instead of silently moving to another port.
