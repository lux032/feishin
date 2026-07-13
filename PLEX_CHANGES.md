# Plex Branch — Divergences from Upstream

This file is the authoritative checklist for every intentional divergence from
[jeffvli/feishin](https://github.com/jeffvli/feishin).  Consult it before and
after each upstream merge to decide what to keep, remove, or update.

---

## New files (plex-branch only)

| File | Purpose |
|------|---------|
| `src/renderer/api/plex/plex-api.ts` | Plex HTTP API client |
| `src/renderer/api/plex/plex-controller.ts` | Plex server controller (implements all controller interfaces) |
| `src/main/fork-config.ts` | Fork-specific build constants (see below) |

---

## Modified shared files

### `src/main/fork-config.ts`
- `UPDATER_OWNER = 'lux032'` — points electron-updater at this fork's GitHub
  releases instead of the upstream `jeffvli` account.
- **Merge rule:** this file does not exist upstream; it never conflicts.

### `src/main/index.ts`
- Imports `UPDATER_OWNER` from `./fork-config` and uses it in
  `GITHUB_UPDATER_CONFIG`.
- **Merge rule:** only the import line and `owner:` field differ from upstream.
  On conflict, keep `import { UPDATER_OWNER }` and `owner: UPDATER_OWNER`; take
  all other upstream changes.

### `src/renderer/api/controller.ts`
- Plex case added to the server-type dispatch switch.
- **Merge rule:** on conflict, keep the `ServerType.PLEX` branch; take upstream
  changes to other branches.

### `src/renderer/api/subsonic/subsonic-controller.ts` / `navidrome-controller.ts`
- Minor additions needed for Plex compatibility (shared Subsonic-dialect
  helpers).
- **Merge rule:** accept upstream, verify Plex still compiles.

### `src/renderer/features/player/components/right-controls.tsx`
- `RatingButton`: uses `hasFeature(server, ServerFeature.STAR_RATING)` (more
  generic than upstream's hardcoded `NAVIDROME || SUBSONIC` check — Plex
  declares `STAR_RATING`).
- `FavoriteButton`: no Plex guard (Plex implements `createFavorite` /
  `deleteFavorite`).
- **Merge rule:** on import conflict, keep both `ServerFeature` and `PlayerType`
  imports.  Keep `hasFeature()` for `showRating`.  Do **not** re-add the Plex
  guard.

### `src/i18n/locales/zh-Hant.json` (and other locale files)
- Plex-specific keys preserved:
  - `toast.plexTokenAuthenticationFailed`
  - `toast.plexTokenRequired`
  - `form.addServer.discoveredServer` — used by `add-server-form.tsx` for
    Plex server discovery display.
- **Merge rule:** accept upstream wording changes; keep the three keys above if
  upstream removes them.

### `src/shared/types/domain-types.ts`, `features-types.ts`, `types.ts`
- `ServerType.PLEX` enum value added.
- `ServerFeature.STAR_RATING` — Plex declares this feature.
- **Merge rule:** keep the `PLEX` entry; take all other upstream additions.

### `src/main/features/core/player/index.ts`
- Plex direct-stream URL handling for lossless playback.
- **Merge rule:** keep the Plex-specific block; take upstream changes to other
  blocks.

### Build / CI files
- `.github/workflows/publish-*.yml`, `electron-builder*.yml` — updated to
  publish under `lux032` GitHub account.
- **Merge rule:** keep plex-branch versions; upstream changes to workflow
  structure can be ported manually if needed.

---

## Feature flags declared by Plex

The Plex controller (`plex-controller.ts`) declares the following features via
the `getServerInfo` response:

- `ServerFeature.STAR_RATING` — rating (0–10 mapped to Plex user ratings)
- _(others as implemented)_

Any UI guard of the form `if (server?.type === ServerType.PLEX) return null`
should be removed once the corresponding controller method is implemented.

---

## Merge workflow

```bash
# 1. Fetch upstream
git fetch https://github.com/jeffvli/feishin.git development

# 2. Preview new commits for Plex-relevant changes
git log --oneline FETCH_HEAD ^HEAD

# 3. Merge
git merge FETCH_HEAD

# 4. Resolve conflicts per the rules in this file
#    rerere will auto-replay previously recorded resolutions.

# 5. Verify
pnpm run typecheck   # or: pnpm run build:web
```
