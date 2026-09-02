# Momento — Architecture

Momento is a smart TV screensaver that turns idle screen time into a "living"
wall of family memories: a mosaic of unique picture frames, each independently
cycling through photos and short video clips, giving the impression of dozens
of memories playing at once.

This document covers the full system. The current repo implements two things
in depth: the **shared TV rendering engine** (`apps/tv-app`, plain HTML/CSS/JS)
and a **working Android/Google TV app** (`apps/android-tv`) that hosts it as a
real, OS-registered Daydream screensaver — installed, built, and verified
running end-to-end on a Google TV emulator (see §5.7). Backend, mobile app,
and the Tizen/webOS packaging noted below remain contracts/plans to build
next.

## 1. Goals & constraints

- **Primary experience**: idle TV screen → ambient wall of framed
  photos/videos that feels alive, warm, and premium (not a slideshow).
- **Target platform (phase 1): Android TV / Google TV.** This was chosen
  over Samsung Tizen and LG webOS for a concrete, verified reason: Android's
  `DreamService` ("Daydream") is a genuine, documented, public third-party
  screensaver extension point — an app can register in
  Settings → Screen Saver and have the OS launch it automatically after
  idle. Tizen and webOS have **no equivalent public hook**:
  - **Samsung Tizen**: only exposes `webapis.appcommon.setScreenSaver()`,
    which *suppresses the TV's own* burn-in screensaver while an app plays
    content — not a way to register as the screensaver.
  - **LG webOS**: only exposes a declarative "Type 3 / Gallery" screensaver
    *mode* (`screenSaverProperties.preferredType: 3` in `appinfo.json`) that
    extends the OLED idle timeout for photo-forward apps — again, not a
    registration hook.
  Both are still real, useful mechanisms (see §5.6) and the engine remains
  portable to them (they're WebKit runtimes too), so that work is kept in
  this repo as a later phase — see the roadmap in §8 — rather than the
  primary path.
- **Verified, not assumed**: every platform capability claim in this
  document was checked against the actual current SDK/docs before relying
  on it (Samsung/LG developer docs, AOSP source for `DreamService` and
  `androidx.webkit.WebViewAssetLoader`) rather than assumed from general
  knowledge, and the Android implementation was actually built, installed,
  and exercised on a real Google TV emulator — see §5.7 for what that did
  and didn't confirm.
- **Content source**: cloud-synced family media, curated/uploaded from a
  companion mobile app. No manual file management on the TV itself.
- **Hardware reality**: TVs are not phones.
  - Low-end/older SoCs: 1 hardware video decoder session. Modern (2021+)
    Tizen/webOS: typically 2, rarely more.
  - Limited GPU compositing budget — too many simultaneously-animated
    elements causes dropped frames and heat/power issues.
  - Limited RAM (often 1.5–2GB total, shared with the OS) — can't hold dozens
    of full-res decoded images/videos in memory at once.
  - Screensavers must be extremely reliable: no crashes, no memory leaks over
    hours/days of continuous idle runtime, and must exit instantly on any
    remote input.

These constraints directly shaped the rendering engine design in §5.

## 2. System components

```
┌─────────────────┐        ┌──────────────────────┐        ┌────────────────┐
│  Companion App   │──REST──▶│   Backend API        │◀──REST──│   TV App        │
│ (iOS/Android/Web)│  auth   │  (accounts, walls,    │  poll/   │ (Google TV      │
│                  │         │   media, pairing)     │  WS      │  Daydream now;  │
│                  │         │                       │          │  Tizen/webOS    │
│                  │         │                       │          │  later)         │
└────────┬─────────┘         └──────────┬────────────┘        └────────┬────────┘
         │ upload originals             │                              │
         ▼                              ▼                              ▼
   ┌───────────┐               ┌────────────────┐             ┌───────────────┐
   │  Object    │◀──transcode──│  Media Pipeline │             │  CDN-served    │
   │  Storage   │   worker      │ (resize/HLS/    │────────────▶│  manifests +   │
   │ (originals)│               │  thumbnails)    │   signed    │  media (jpg/   │
   └───────────┘               └────────────────┘   URLs       │  webp/mp4)     │
                                                                └───────────────┘
```

- **Companion app**: onboarding, family/account management, media upload,
  organizing media into one or more "Walls," choosing frame styles, and
  pairing a TV.
- **Backend API**: accounts, families, walls, media metadata, device pairing,
  serving the TV app its "wall manifest."
- **Media pipeline**: on upload, generates TV-ready renditions — this is what
  makes playback on constrained hardware possible (see §4).
- **TV app**: fetches a wall manifest, caches media locally, and runs the
  rendering engine described in §5.

## 3. Data model

```
Family
  id, name, members[]

Wall  (a "media wall" a family curates — a TV can display one Wall)
  id, familyId, name
  frameStyleKit: string        // e.g. "heirloom", "modern-gallery"
  layoutSeed: number           // deterministic mosaic layout per wall
  frameCount: number           // how many frames to show (default 8; users
                               // can raise this, capped by screen size)
  createdAt, updatedAt

MediaItem
  id, wallId, type: "photo" | "video"
  originalUploadId
  frameSize: "9:16" | "3:4" | "1:1" | "4:3" | "16:9"   // creator-selected
                               // display ratio (defaults offered: 9:16 & 3:4 —
                               // vertical dominates modern phone content)
  caption: string               // creative free-text displayed on the frame
  renditions: {
    thumbnail: url,            // ~200px, always preloaded
    display: url,              // ~1080p long edge, for photos
    hls: url | null,           // for videos: HLS playlist, multiple bitrates
    dominantColor: string,     // for placeholder/letterbox background
    focalPoint: {x, y}         // crop/Ken-Burns anchor (see §4)
  }
  durationMs: number | null    // video length
  capturedAt: date             // for "on this day" style ordering later
  favorite: boolean

Device (a paired TV)
  id, wallId, platform: "android-tv" | "tizen" | "webos"
  pairingCode, pairedAt, lastSeenAt
  manifestETag                // for cheap polling

FrameStyleKit (design asset bundle, versioned + CDN-hosted)
  id, name
  frames: FrameStyleDef[]      // border art, typography hints, css vars
```

A **Wall** is intentionally the unit of display — one TV = one Wall, but a
Wall can pull media from multiple family members' uploads.

## 4. Media pipeline (why the TV app can stay simple)

All the "hard" media work happens off-device, at upload time, not on the TV:

1. **Upload** (companion app → backend): original photo/video goes to object
   storage (e.g., S3-compatible bucket) with resumable upload support for
   large videos on mobile networks.
2. **Transcode worker** (queue-driven, e.g. on upload-complete event):
   - Photos → generate `thumbnail` (fast preload), `display` (capped at
     1080p/1440p long edge — TVs never need more, and this caps decode cost),
     WebP + JPEG fallback.
   - Videos → trim/normalize to a short **loop-friendly clip** (screensaver
     clips should be short, 6–20s, silent — long clips add no value on a
     screensaver and cost more memory), transcode to H.264 HLS at 2–3
     bitrates (TV picks based on measured throughput), generate a poster
     thumbnail from the first frame.
   - **Focal point detection**: lightweight face/saliency detection to pick a
     Ken-Burns pan/zoom anchor so faces are never cropped out. Falls back to
     center-crop if detection is inconclusive.
   - Compute `dominantColor` for instant letterboxing before the image
     decodes (avoids flash-of-black on slow TV storage/network).
3. **CDN**: all renditions served from a CDN with long cache lifetimes and
   content-hashed URLs, so the TV can cache aggressively and never re-fetch
   unchanged media.
4. **Wall manifest**: backend composes a single JSON document per Wall
   (`GET /walls/:id/manifest`) listing all current `MediaItem`s + the
   `FrameStyleKit` reference. The TV app's *only* backend dependency at
   runtime is this manifest endpoint (+ the CDN for assets).

This means the TV rendering engine never touches raw uploads, never
transcodes, and never runs ML — it just plays pre-optimized files. That's
what makes smooth playback possible on weak hardware.

## 5. TV rendering engine (implemented in `apps/tv-app`)

This is the "living video wall" itself. Four cooperating modules:

### 5.1 Layout engine (`src/core/layout.ts`)
Generates a **mosaic** of frame slots (not a uniform grid) filling the 16:9
canvas with varying sizes/aspect ratios (portrait, square, landscape,
panoramic) — mimicking a real curated gallery wall rather than a spreadsheet.
Layout is deterministic from a seed (per Wall) so it's stable across
restarts, but can reflow when the media count changes.

Frame count is a *setting, not an emergent side effect*: the packer
enumerates a few candidate grid sizes and picks the one whose packed frame
count lands closest to the wall's configured `frameCount` (default **8** —
a future on-device Settings slider lets users raise it, capped by screen
size so a 4K set can host a denser wall than a 1080p one; `src/core/frameSizes.ts`).

Frames themselves render at the **creator's selected frame size** (see
`frameSizes.ts`): each slot has a shape *family* (portrait/landscape/square/
panoramic grid span) plus a true display ratio (e.g. 9:16 vs 3:4 within the
portrait family), applied via CSS `aspect-ratio` and centered within the
grid cell — so a 9:16 frame genuinely reads tall/narrow rather than being
stretched or cropped into a generic rectangle. To keep even a small 8-frame
wall from degrading into a uniform grid, the packer rebalances families
(uses the least-used family that fits next).

### 5.2 Media scheduler (`src/core/scheduler.ts`)
The key hardware-aware piece. Rather than naively giving every frame a
`<video>` loop (which would exceed decoder budgets instantly), the scheduler:

- Maintains a **live video budget** (default 2, configurable per platform)
  — only that many frames may have an active decoding `<video>` element at
  once.
  ┌ this directly encodes the constraint from §1.
- All other frames display a **photo with Ken-Burns pan/zoom** — pure CSS
  `transform`/`opacity` animation, effectively free on TV GPUs, and visually
  still feels alive.
  ┌ this is the trick that makes the *whole wall* feel like a living video
    wall while only 1–2 frames are ever truly decoding video.
- On an independently-jittered interval per frame (~8–20s, randomized so
  frames never sync up / flash together), each frame requests its next
  media item from a shared pool and crossfades to it.
  ┌ prevents "8-frame wall" feel; feels organic instead of mechanical.
- When assigning media it **prefers items whose selected frame size matches
  the slot's** (exact ratio first, then same shape family) so a 9:16
  vertical clip lands in a 9:16 frame rather than getting agressively
  cropped into a squarer one, falling back gracefully when nothing matches.
- "Liveness" rotates: periodically, the scheduler retires one live-video
  frame back to photo mode and promotes a different frame to video, so the
  *sense* of live video moves around the wall over time rather than always
  living in the same two frames.
- **Preloading**: the next media item per frame is preloaded (image
  `decode()` / `<link rel=preload>` for the next HLS segment) one cycle
  ahead, off the visible element, so crossfades never show a loading state.
- **Resource pooling**: a fixed pool of `<img>`/`<video>` elements is reused
  across frames (object pooling) instead of creating/destroying DOM nodes per
  transition — avoids GC churn and layout thrash over many hours of runtime.

### 5.3 Frame renderer (`src/core/frame.ts`)
Renders one slot: the picture-frame border (CSS-driven "frame style," see
§5.4) + the inner media element + crossfade transition between the outgoing
and incoming media (two stacked layers, opacity swap).

### 5.4 Frame style kit (`src/styles/frames.css`)
Each `FrameStyleKit` is a set of visual frame treatments (e.g. gold ornate,
walnut wood, polaroid, thin modern metal, black filmstrip w/ sprocket
holes). In production these become real texture/border image assets designed
by hand; the prototype approximates them with layered CSS
(gradients/shadows/borders) so the concept is provable without asset
production. Swapping in real PNG/WebP frame art later is a drop-in change to
this module only — nothing in the layout/scheduler needs to change.

Captions (each `MediaItem`'s creative free-text, §3) are displayed on **every**
frame style, not just Polaroid: each style applies its own typography — a
handwritten-feel strip below the photo on Polaroid, engraved-plaque italic
serif on gold, warm labeled-serif on walnut, museum-placard uppercase sans on
metal, and a typewriter/timecode monospace on filmstrip — layered over a
bottom scrim so the text stays legible over any photo/video.

### 5.5 Wall renderer (`src/core/wall.ts`)
Top-level orchestrator: builds the layout, spins up one `Frame` per slot,
owns the ambient background (subtle wall texture + gentle vignette/parallax),
starts the scheduler, and owns the debug HUD (FPS, active decoder count,
memory hint) for development/QA on real devices.

### 5.6 Tizen/webOS lifecycle & remote input (`src/platform/*`, later phase)
These platforms are a later phase (§8), not deleted — the engine is shared,
only packaging differs. On both, Momento would ship as a manually-launched
full-screen app rather than an OS-registered screensaver (see §1). Thin
per-platform shims handle what's actually available:
- **Tizen** (`platform/tizen.ts`): on start, call
  `webapis.appcommon.setScreenSaver(SCREEN_SAVER_OFF)` (requires
  `$WEBAPIS/webapis/webapis.js` loaded in `index.html`) so the TV's own
  burn-in screensaver doesn't cut in during a long ambient session; restore
  it (`SCREEN_SAVER_ON`) on pause/suspend. Exiting the app uses the
  standard `tizen.application.getCurrentApplication().exit()` Web Device
  API.
- **webOS** (`platform/webos.ts`): declare the Type 3 gallery screensaver
  behavior declaratively in `appinfo.json` (see `platform/webos/appinfo.json`)
  rather than a runtime call — LG's platform then handles the extended
  timeout/dim itself. For an explicit exit path, `webOS.platformBack()`
  from the `webOSTVjs` helper library requests the platform's back/exit
  handling (popup to exit, or Home launcher on older webOS); this requires
  `disableBackHistoryAPI: true` in `appinfo.json` plus listening for the
  Magic Remote Back key (`keyCode 461`).
- **Both**: any remote key or pointer input dismisses Momento immediately
  (it's meant to be an ambient background, not something that traps the
  user) — handled by one platform-agnostic `RemoteInput` interface so the
  rendering engine itself never touches platform APIs directly; only
  key-code mapping and the two lifecycle calls above differ per platform.

### 5.7 Android/Google TV — the real Daydream implementation (`apps/android-tv`)
This is the actual current primary target (§1), and unlike §5.6, it's a
**working, built, installed, and verified app**, not just a plan. Structure:

- **`MomentoDreamService`** (`android.service.dreams.DreamService`): the
  real screensaver. Registered via the standard manifest pattern (intent
  filter for `android.service.dreams.DreamService` + `BIND_DREAM_SERVICE`
  permission + a `<dream>` meta-data resource) — verified directly against
  AOSP's `DreamService.java` source rather than assumed. Non-interactive by
  default, so any remote input wakes/tears it down automatically — no
  custom key handling needed.
- **`WebEngineHost`**: shared code (used by both the Dream and the in-app
  Preview below) that hosts `apps/tv-app`'s built output in a `WebView`
  via `androidx.webkit.WebViewAssetLoader`, serving local assets over a
  synthetic `https://appassets.androidplatform.net/...` origin rather than
  `file://`. This matters concretely: the engine's `<script type="module">`
  tags fail to load under `file://` (WebView applies the same-origin policy
  to module scripts) — confirmed against `WebViewAssetLoader`'s own source/
  javadoc, and against real behavior on device (see below).
- **`MainActivity`**: minimal launcher screen with two actions — "Preview"
  (opens `PreviewActivity`, a full-screen `WebEngineHost` view — this is
  also how the integration gets exercised in development without needing
  either a signed-in Google account or a physical device) and "Open Screen
  Saver Settings" (`Settings.ACTION_DREAM_SETTINGS` — also verified against
  AOSP source, not assumed).
- **Gradle integration**: `app/build.gradle.kts` defines `buildWebEngine`
  (runs `npm run build` in `apps/tv-app`) and `syncWebEngineAssets` (copies
  `dist/` into `app/src/main/assets/web`), wired into `preBuild` — so a
  normal `./gradlew assembleDebug` always ships the current engine.

**What was actually verified, on a real Google TV emulator (arm64, native
on Apple Silicon, via Android Studio's own SDK tooling) — not just "should
work":**
- ✅ The Gradle project builds cleanly end-to-end (including the web-engine
  build/sync step) and installs on-device.
- ✅ Launching the in-app Preview renders the real mosaic — correct frame
  styles, photo labels, crossfades, and the scheduler's live-video budget
  (confirmed via the debug HUD reading `Live video: 2/2` inside the actual
  WebView) — i.e., the WebView + `WebViewAssetLoader` integration genuinely
  works for this engine, not just in a desktop browser.
- ⚠️ **Not yet verified**: the full system flow of a signed-out-of-Google
  emulator's Settings → System → *Ambient Screensaver* picker actually
  listing and launching Momento. That screen reports "Unavailable — please
  set up Google TV" until the emulator completes real Google account
  sign-in, which wasn't done here (and current Google TV emulator system
  images ship as locked-down `user` builds — no `adb root`, so the
  `cmd dreams start-dreaming` shell shortcut isn't available either as a
  workaround). This is a testing-environment gap, not a code defect — the
  manifest registration is the standard, correct pattern — but it should be
  confirmed for real before considering this "done": either sign into a
  real Google account in the emulator, or test on a physical Google TV
  device/Chromecast with Google TV.
- One current toolchain wrinkle worth flagging for whoever opens this
  project next: AGP 9.0's new default `android.newDsl`/`android.builtInKotlin`
  behavior conflicts with the separate `org.jetbrains.kotlin.android` Gradle
  plugin used here; `gradle.properties` opts out of both (documented inline
  there) rather than migrating to the very-new built-in-Kotlin DSL. Worth
  revisiting as that DSL matures.

## 6. Sync & pairing protocol

- **Pairing**: TV app on first run (or from a settings screen) displays a
  short numeric/QR pairing code (`POST /devices/pair/start` → code). User
  enters that code in the companion app, which calls
  `POST /devices/pair/confirm` linking the device to a Wall. TV polls
  `GET /devices/:id/pair-status` until linked, then persists a device token
  locally (Tizen/webOS both expose a local key-value storage API for this).
- **Ongoing sync**: TV polls `GET /walls/:id/manifest` on an interval
  (e.g., every 15–30 min) using `If-None-Match` with the last `manifestETag`
  — cheap 304s in the common case. A future improvement is a lightweight
  WebSocket/SSE push ("wall updated") to refresh sooner when a family member
  just added new photos, but polling is a perfectly adequate v1 — screensavers
  aren't latency-sensitive.
- New media is diffed into the running wall gracefully (new items join the
  scheduler's pool; removed items are faded out and evicted from the
  resource pool) — never a hard reload/flicker of the whole wall.

## 7. Companion app (scope for a future build)

- Auth + family creation/invites.
- Upload flow (camera roll picker, background/resumable upload).
- Wall management: create walls, assign media to walls, pick a
  `FrameStyleKit`, reorder/favorite/remove items.
  TV pairing screen (enter code / scan QR).
- Push notifications optional ("Grandma added 12 new photos to the Wall").

## 8. Roadmap

1. ✅ **Phase 0** — rendering engine prototype (`apps/tv-app`): mosaic
   layout, scheduler with live-video budget, CSS frame styles, debug HUD,
   runnable in any browser.
2. ✅ **Phase 1 (current)** — Android/Google TV Daydream app
   (`apps/android-tv`): real `DreamService` hosting the engine via
   `WebViewAssetLoader`, built and verified on a Google TV emulator (§5.7).
   Remaining before calling this fully done: confirm the system Screen
   Saver picker flow on a signed-in emulator or physical device (§5.7's
   "not yet verified" note).
3. **Phase 2** — Backend API + media pipeline (manifest endpoint, upload +
   transcode worker, pairing). Wire the app to real manifests instead of
   `mockMedia.ts`.
4. **Phase 3** — Companion mobile app (upload, wall curation, pairing UI).
5. **Phase 4** — Tizen + webOS packaging (already scaffolded in
   `platform/tizen`, `platform/webos`, `src/platform/tizen.ts`,
   `src/platform/webos.ts` — see §5.6): real `.wgt`/`.ipk` builds, test on
   Tizen Studio / webOS TV emulators + at least one physical TV per
   platform, verify the Tizen screensaver-suppression toggle + webOS
   gallery-mode config + remote-exit behavior + multi-hour memory
   stability.
6. **Phase 5** — tvOS (no public third-party screensaver hook there either,
   so it'd follow Tizen/webOS's manual-launch model) and/or a native
   Compose-for-TV rewrite of the Android app if WebView performance proves
   insufficient on real low-end hardware.
7. **Phase 6** — polish: real designed FrameStyleKits, "on this day" smart
   ordering, ambient audio option, multi-wall households, shared/extended
   family contributions.
