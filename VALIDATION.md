# Validation

## Automated checks completed

- `npm test`: 29 tests passed for state retention, JSON validation/round trips, import non-mutation and replacement, quota failure/recovery, v1 storage and backup upgrades, load validation/history, explicit warm-up doses, load-method snapshots, preparation/working-volume separation, older v2 compatibility, complete-session consistency, fixed rest presets and service-worker cache isolation/relative paths.
- `npm run check`: app, state and service-worker JavaScript syntax passed.
- Headless Chrome checks using the machine's existing Playwright installation passed for the mobile header, panel changes without forced scrolling, expandable warm-up/video links, load save/reload, decimal entry, dated history across midnight, prior-load hints, reset preserving loads, JSON downloads and confirmed replacement, independent browser-context transfer, light/dark themes, and horizontal overflow at 320, 390 and 1366 px. Screenshots were inspected at 390 × 844 and 1366 × 768.
- Chrome also passed an actual service-worker offline reload and local set saving without network access. A separate check migrated v1 browser data while preserving its source, simulated quota failure without a false save confirmation, kept the load dialog actionable and successfully retried the pending marks and load. Browser tests use fresh synthetic profiles, never the owner's real browser history.
- The browser runner is a temporary validation harness, not a runtime dependency. Screenshots and result summaries are local review artifacts outside the repository.
- A subsequent Chrome pass checked explicit warm-up and training doses on all five days, push-up/pull-up quantities, exercise-specific ramp steps, unchanged working-set progress, method/effort explanations, JSON metadata retention, offline loading of the prescription module, and responsive dark/light layouts at 320, 390 and 1366 px. The unilateral-exercise metrics use a compact grid so the load action stays alongside the prescription.

## Mobile scrolling finding

Before the revision, tapping **Treinar** at a 390 × 844 viewport moved the page from `scrollY=0` to `524`; the settings button's top became `-506`. The revised panel switch keeps `scrollY=0`, and the fixed mobile header remains reachable while scrolling. Native Safari elastic scrolling and the software keyboard still need a physical-device check.

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
