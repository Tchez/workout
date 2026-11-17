# Workout

A Portuguese personal workout PWA: a five-day training plan, mobility instructions with YouTube references, set completion, a rest timer and dated sessions saved in the browser. Settings export and restore a portable JSON backup for manual transfers between devices.

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

## Storage behavior

- `workout-state-v1` in `localStorage` holds preferences and sessions. Sessions are keyed by São Paulo calendar date and training-day ID. Earlier dates remain saved; the current settings panel lists the 20 most recent sessions, while export includes all of them.
- Opening a training day creates only an in-memory draft. A set change or completed warm-up saves a session. Exercise IDs and planned sets/reps are captured for that session so later plan edits do not rewrite its prescription.
- Read failures block automatic writes to avoid replacing corrupt saved data. Write failures retain the current in-memory state and show an export reminder. Quota and eviction behavior remain browser-controlled.
- Settings can request persistent storage, when supported. A denial does not disable the app. Even a grant does not protect against manual deletion; regular JSON backups are still needed.
- Existing `marco-workout-v1` data is migrated when found on the same origin. The legacy key is left intact. Data on a different host, port or file origin cannot be read automatically; moving to a custom domain requires export/import.
- **Apagar sessões deste navegador** asks for confirmation, offers backup first, keeps the selected theme and only affects Workout's data. Resetting the current training day leaves other sessions intact.
- Timer countdowns are transient. No load/repetition logging, accounts, backend or automatic device synchronization is included in this increment.

## Files and maintenance

| File | Responsibility |
| --- | --- |
| `index.html`, `app.css`, `app.js` | Responsive UI, timers, settings and PWA registration |
| `workout.json` | Shipped training prescription; update intentionally |
| `state.js` | Schema validation, legacy migration, storage and JSON backup |
| `sw.js` | Versioned offline app shell, scoped to this deployment path |
| `manifest.webmanifest`, `icons/` | Install metadata and local app icons |
| `state.test.js`, `sw.test.js` | Data safety, round-trip and offline-path tests |

When changing any app-shell asset, bump `RELEASE` in `sw.js`. The worker precaches the release and waits when an older worker is active. Settings offers **Atualizar aplicativo**; the app saves state before activating the new worker and reloading. Cache cleanup only deletes old Workout caches for the same deployment path.

## Validation

Node.js 20+ runs the dependency-free checks:

```sh
npm test
npm run check
```

The tests cover retention across dates, immutable prescription snapshots, backup round trips, preview non-mutation, replacement rather than merging, invalid files, quota failure, legacy recovery, GitHub Pages subpaths and offline-cache isolation. See [VALIDATION.md](VALIDATION.md) for the actual checks and remaining device checks.
