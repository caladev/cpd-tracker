# CPD Tracker

A beautiful local web app to track CA ANZ Continuing Professional Development (CPD) hours per the
CR 7 regulation, with rule configs per period, evidence attachments, and pro-rata exemptions.

## Run it

```bash
npm install
npm run dev        # UI on http://localhost:5173, API on :5174
npm test           # unit tests
npm start          # production build + app served on :5174
```

## Data

Everything lives in iCloud Drive:

```
~/Library/Mobile Documents/com~apple~CloudDocs/Docs/CA/cpd-tracker-app-data/
├── cpd_data.db            # the JSON dataset (versioned)
├── evidence/<entryId>/…   # images / PDFs attached to entries
└── rules/<reg.pdf>        # regulation PDFs per ruleset
```

Override the data directory with the `CPD_DATA_DIR` environment variable. API port via `PORT`.

## Architecture

- **React + Vite** frontend (`src/`), custom CSS design system.
- **Express + multer** API (`server/`) — atomic JSON writes, sanitized file uploads.
- Pure logic lives in `src/lib/` (dates, rules, defaults) and is unit-tested with Vitest.