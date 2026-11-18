# Workout

A Portuguese personal workout PWA: a five-day training plan, expandable warm-up instructions with YouTube references, set completion, fixed rest timers and exercise loads saved by date. Settings export and restore a portable JSON backup for manual transfers between devices.

**Live app:** https://tchez.github.io/workout/ · **Repository:** https://github.com/Tchez/workout

## Run locally

No build step, package installation or runtime dependencies are needed. Serve the repository over HTTP, rather than opening `index.html` directly: modules, the workout JSON and the service worker use browser HTTP APIs.

```sh
python3 -B -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. Alternatively use `npm start`. The app uses relative URLs and also works under a repository subpath such as `/workout/`.

## Publish on GitHub Pages

1. Upload this repository to GitHub, including the `icons` directory and `.nojekyll`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select the branch containing these files and **/ (root)**, then save.
3. Open the HTTPS address reported by GitHub. For a repository called `workout`, a project site normally uses `https://<username>.github.io/workout/`.
4. After the first connected visit and successful cache installation, the training interface can reopen offline. YouTube demonstrations require internet.

See [GitHub's publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). This repository publishes from `main` at `/ (root)`. The GitHub Pages address is `https://tchez.github.io/workout/`; `.nojekyll` keeps this a static deployment.

On iPhone, open the HTTPS site in Safari and use **Share → Add to Home Screen**. Desktop and Android installation controls depend on the browser. Manifest and service-worker support need HTTPS in production; localhost is suitable for development. See [MDN's installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Transfer or restore data

In **Configurações**, choose **Baixar backup JSON**, move that file to the other device and choose **Importar backup JSON** there. The app validates the file, shows incoming and local session counts and offers to download the current state before replacement. Nothing is changed until **Substituir dados e importar** is selected. Cancel leaves local data intact. Import replaces all sessions and preferences; it does not merge records.

The backup has a versioned envelope and includes preferences, all saved sessions and each session's exercise prescription snapshot. Invalid JSON, unsupported versions, inconsistent data and files over 5 MiB are rejected. A failed storage write does not report import success or replace the previous stored state. Treat exported backups as personal data; do not commit them to the public repository.

## Workout flow

- The current weekday opens by default. Mobile keeps **01 Aquecer / 02 Treinar**, progress and an always-accessible header with a settings gear. Switching panels does not automatically scroll the page.
- General warm-up activities appear as expandable list items, each with sets and repetitions or a timed duration. Upper-body days include easy push-ups and assisted pull-ups as needed. YouTube links are limited to mobility demonstrations.
- Exercise-specific preparation appears inside its exercise card, with exact repetitions and percentages of the planned working load. **Carga crescente** describes preparation ramps; **Carga estável** describes the current working sets. Percentages refer to today's working load, not a one-repetition maximum, and are approximate equipment-adjusted references. The load dialog explains the prescribed repetitions in reserve.
- Preparation sets have their own count and never increase working-set checkboxes, progress or the weekly training volume. A card can prescribe **2 × 6** preparatory repetitions followed by **3 × 6–10** working repetitions. Method labels distinguish within-session load behavior from progression across workouts; maximum-load testing is not prescribed by this plan.
- Tap **Carga +** on an exercise to save today's load in kilograms. Decimal commas and zero are supported. Each exercise has one load per dated session, with prior loads available in its dialog and the latest earlier load shown on the workout card. Use a consistent convention for dumbbells and machines; set-by-set loads and actual repetition logging are outside this increment.
- Rest buttons use one duration matching their countdown: 2 minutes for compound exercises, 90 seconds for Bulgarian squats and 60 seconds for the other accessories. **+30s** still lets the user extend an active rest manually.
- Every set change, completed warm-up and saved load writes immediately. The progress card confirms successful saves or reports unavailable storage. Installing the PWA and finalizing the workout are not prerequisites for saving.
- **Configurações → Sessões registradas** expands dated sessions to show completed sets and loads. The current day's workout starts unmarked; earlier sessions remain in history and backups. Resetting today's marks preserves loads and previous dates.

## Storage behavior

- `workout-state-v2` in `localStorage` holds schema version 2 preferences and sessions, including exercise loads. Sessions are keyed by São Paulo calendar date and training-day ID. Earlier dates remain saved; settings lists the 20 most recent sessions, while export includes all of them.
- Opening a training day creates only an in-memory draft. A set change, saved load or completed warm-up saves a session. Exercise IDs and planned sets/reps are captured for that session so later plan edits do not rewrite its prescription. New snapshots also preserve load mode, repetitions in reserve and specific preparation steps. These metadata fields are optional for older v1/v2 records; a current workout without them displays the live plan guidance while retaining its saved working-set count and loads. Previous loads are a reference, not automatically recorded as today's load.
- Read failures block automatic writes to avoid replacing corrupt saved data. Write failures retain the current in-memory state, show an export reminder and allow retry. Quota and eviction behavior remain browser-controlled.
- Settings can request persistent storage, when supported. A denial does not disable the app. Even a grant does not protect against manual deletion; regular JSON backups are still needed.
- Existing `workout-state-v1` data or the older `marco-workout-v1` format is migrated when found on the same origin. Source keys remain intact until an explicit clear; the new key prevents older open app versions from discarding load fields. Version 1 backups are still accepted and upgraded on import. Corrupt current data is never replaced by an older fallback.
- Data belongs to the browser and its storage context. Different browsers, private windows and some installed-app contexts may have separate storage. Data on a different host, port or file origin cannot be read automatically; use export/import to move it, including when adopting a custom domain.
- **Apagar sessões deste navegador** asks for confirmation, offers backup first, keeps the selected theme and only affects Workout's data. Resetting the current training day leaves other sessions intact.
- Timer countdowns are transient. No actual repetition logging, accounts, backend or automatic device synchronization is included in this increment.

## Files and maintenance

| File | Responsibility |
| --- | --- |
| `index.html`, `app.css`, `app.js` | Responsive UI, timers, settings and PWA registration |
| `workout.json` | Shipped training prescription; update intentionally |
| `state.js` | Schema validation, legacy migration, storage and JSON backup |
| `prescription.js` | Dose formatting and validation of load methods, effort and preparation snapshots |
| `sw.js` | Versioned offline app shell, scoped to this deployment path |
| `manifest.webmanifest`, `icons/` | Install metadata and local app icons |
| `state.test.js`, `prescription.test.js`, `sw.test.js` | Data safety, prescription/working-volume, round-trip and offline-path tests |

When changing any app-shell asset, bump `RELEASE` in `sw.js`. The worker precaches the release and waits when an older worker is active. Settings offers **Atualizar aplicativo**; the app saves state before activating the new worker and reloading. Cache cleanup only deletes old Workout caches for the same deployment path.

## Validation

Node.js 20+ runs the dependency-free checks:

```sh
npm test
npm run check
```

The tests cover retention across dates, immutable prescription snapshots, explicit doses, separation of preparation and working volume, method/effort validation, load history, backup round trips, v1 upgrades, preview non-mutation, replacement rather than merging, invalid files, quota recovery, legacy recovery, rest presets, GitHub Pages subpaths and offline-cache isolation. See [VALIDATION.md](VALIDATION.md) for the actual checks and remaining device checks.
