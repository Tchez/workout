# Validation

## Automated checks completed

- `npm test`: 16 tests passed for state retention, JSON validation/round trips, import non-mutation and replacement, quota failure, legacy migration/recovery, complete-session consistency and service-worker cache isolation/relative paths.
- `npm run check`: app, state and service-worker JavaScript syntax passed.
- The new settings event handlers were also exercised in a temporary in-memory DOM harness using the machine's existing jsdom installation: marking a series, exporting a JSON Blob, preview/cancel, confirmed replacement/theme application, invalid JSON feedback, stale-preview rejection and confirmed clearing all passed. This additional harness is not a browser or device-installation test and is not a runtime dependency.
- The underlying responsive layout was visually checked at mobile and desktop sizes in the preceding HTML iteration. The new settings controls have not received a fresh visual browser pass.

## Published deployment

- Public repository: https://github.com/Tchez/workout.
- GitHub Pages: https://tchez.github.io/workout/, publishing `main` from the repository root with HTTPS enforced.
- The initial app commit is `4bf165210880872219aedf55b17862a76cd62db7`; the first [Pages deployment](https://github.com/Tchez/workout/actions/runs/44166135740) completed successfully on 2026-11-17.
- HTTPS checks returned 200 for the root page and all ten additional app-shell resources, with expected content types. Every response matched its tested local file byte-for-byte, including the web manifest, service worker and install icons.

## Device checks still required

- First visit over GitHub Pages HTTPS, install from Safari/Android/desktop, close and reopen in airplane mode.
- Export a real backup on one device and import it on another, including each platform's download/file-picker behavior.
- Install an app-shell update and confirm the waiting-worker update control, saved sessions and offline reopen.
- Confirm browser-specific persistent-storage behavior. A successful request is never a guarantee against manual data deletion.

The HTTP and deployment checks do not establish physical-device installation, offline reopening, or cross-device file-picker behavior. Those remain manual device checks.
