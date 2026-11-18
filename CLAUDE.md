# Workout engineering

Static, Portuguese workout PWA. Read README.md for product behavior, storage semantics, deployment and checks. This repository must remain self-sufficient.

- Use buildless HTML/CSS and ESM JavaScript; no production dependencies. Preserve the graphite/lime visual reference and mobile-first workout flow.
- `state.js` owns canonical data, validation and migration. Keep its tests next to it. Never clear previous dates as part of a date rollover. Loads belong to exercise IDs within dated sessions; preserve v1 backups and storage during upgrades.
- Imports preview before an explicitly confirmed, validated replacement. Save failure must retain previous stored data and leave the dialog actionable. Escape imported text before rendering HTML.
- Keep URLs relative for GitHub Pages project paths. Bump `sw.js` RELEASE when changing a cached asset. Do not cache external videos or delete another app's caches.
- Keep personal health notes and exported state out of the public repo. Docs, code and comments use English; UI text uses Portuguese with proper accents.
- Keep the workout screen concise: preparation belongs in expandable warm-up items, load history belongs in its dialog, and mobile settings must remain reachable without automatic scrolling.
- Do not commit, push or publish unless asked. Backend, accounts, editable multi-plan workflows and per-set load/repetition logging require separate scope.
- Validate changes with `npm test` and `npm run check`; additional UI and real-device checks must be reported honestly.
