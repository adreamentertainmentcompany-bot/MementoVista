# Momento

Momento turns a smart TV into a "living" wall of family memories: a mosaic
of unique picture frames — gold ornate, walnut wood, polaroid, modern metal,
filmstrip — each one independently cycling through photos and short video
clips. Only a couple of frames are ever truly playing video at once (real TV
hardware can't decode more), but because everything else pans/crossfades
independently and "liveness" rotates around the wall over time, the whole
thing reads as a living video wall rather than a slideshow.

**Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) first.** Short version
of what's in there: **Android/Google TV is the current primary platform**,
specifically because Android's `DreamService` ("Daydream") is a real, public,
documented way for a third-party app to register as the TV's actual idle
screensaver. Samsung Tizen and LG webOS don't have an equivalent hook
(verified against their own developer docs) — they're a later phase, with
their packaging already scaffolded (`platform/tizen`, `platform/webos`) so
that work isn't lost, just not first.

## What's here

```
apps/tv-app/           The shared rendering engine — plain HTML/CSS/JS,
                        runs in any browser, and is what apps/android-tv
                        (and later Tizen/webOS) package and host.
  src/core/             layout (mosaic), scheduler (live-video budget),
                        frame (crossfade + Ken-Burns), wall (orchestrator)
  src/platform/         Tizen/webOS lifecycle shims + remote-input handling
  src/styles/           The 5 CSS-only frame styles + Ken-Burns keyframes
  scripts/              Generates the placeholder demo photos/videos

apps/android-tv/       A real, working Google TV app: MomentoDreamService
                        hosts apps/tv-app in a WebView as an actual
                        registered Daydream screensaver. Built, installed,
                        and verified end-to-end on a Google TV emulator.
                        See apps/android-tv/README.md.

platform/tizen/         config.xml template for Tizen Studio packaging (later phase)
platform/webos/         appinfo.json template for webOS CLI packaging (later phase)

docs/ARCHITECTURE.md    Full system design + roadmap
```

## Quick start — Android/Google TV (primary)

See [`apps/android-tv/README.md`](apps/android-tv/README.md) for full SDK/
emulator setup. Once you have a Google TV AVD running:

```bash
cd apps/android-tv
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :app:installDebug
adb shell am start -n com.momento.tv/.MainActivity
```

Press **Preview** on the app's home screen to see the full-screen wall
immediately — this exercises the exact same WebView + engine code path the
real Daydream service uses, and is the fast dev loop (the system Settings →
Ambient Screensaver picker is gated behind completing Google account setup
in the emulator — see that README for details).

## Quick start — web engine only (fastest, no Android tooling needed)

```bash
cd apps/tv-app
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

You should see a mosaic of ~16 frames in varied styles/shapes; two of them
(by default) are playing looping "video," the rest are photos gently
panning/zooming (Ken-Burns). A small HUD in the top-left shows FPS and the
live-video budget in use. Press any key or click to see the exit/dismiss
behavior a real remote-control press would trigger.

- `npm run build` — type-checks and produces a static `dist/` bundle. This
  is what `apps/android-tv`'s Gradle build automatically runs and packages
  as Android assets (see its README), and what you'd unpack into a Tizen
  `.wgt` or webOS `.ipk` project later.
- Regenerate the placeholder media any time with
  `node scripts/generate-mock-assets.mjs` (requires `ffmpeg` on PATH for
  the video clips; photos are plain SVGs with no dependencies).

## Tuning the engine

Edit the `EngineConfig` in `apps/tv-app/src/main.ts`:

| Field | What it does |
|---|---|
| `liveVideoBudget` | Max frames allowed to decode video simultaneously (2 is a safe default for most 2021+ TVs; use 1 for older/lower-end hardware). |
| `minCycleMs` / `maxCycleMs` | How long a photo frame dwells before crossfading to its next item. |
| `livenessRotateMs` | How often "which frames get to be live" rotates around the wall. |
| `targetFrameCount` | How many frames the wall shows (default **8**). `?frames=` in the URL overrides it, auto-clamped so a 4K screen can host more than a 1080p one — this is the knob a future Settings screen exposes. |
| `enabledFrameSizes` | Which creator-selectable frame-size ratios exist (`9:16`, `3:4` portrait defaults + `16:9`, `4:3` landscape). `?frameSizes=9:16,3:4` previews just the portrait set. |
| `debugHud` | Toggle the FPS/decoder-budget overlay (`?hud=0` in the URL also disables it). |

## Next steps

See the roadmap in `docs/ARCHITECTURE.md` §8. Immediate next step: confirm
the real Settings → Ambient Screensaver picker flow (signed-in emulator or
physical device) to close the one open item from §5.7. After that: backend/
media pipeline, companion app, then Tizen/webOS packaging.
