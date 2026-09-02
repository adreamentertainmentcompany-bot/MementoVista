import "./styles/wall.css";
import "./styles/frames.css";
import { Wall } from "./core/wall";
import { DEFAULT_FRAME_COUNT, DEFAULT_FRAME_SIZES, clampFrameCount } from "./core/frameSizes";
import { loadMockManifest } from "./core/mockMedia";
import type { EngineConfig, FrameSizeId } from "./core/types";
import { detectPlatform, initRemoteInput } from "./platform/remoteInput";
import { exitTizenApp, suppressTizenSystemScreenSaver } from "./platform/tizen";
import { exitWebosApp } from "./platform/webos";

/**
 * Prototype entry point (docs/ARCHITECTURE.md "Phase 0"). In production
 * this config would come from the paired device's platform + the wall's
 * FrameStyleKit, and `loadMockManifest()` would be replaced by a fetch to
 * `GET /walls/:id/manifest` (§4/§6 of the architecture doc).
 *
 * `targetFrameCount` and `enabledFrameSizes` are the two things a future
 * on-device Settings screen would expose to users (§7). Until that UI
 * exists, `?frames=` and `?frameSizes=` URL params let you preview any
 * combination here, mirroring the existing `?hud=` convention.
 */
const params = new URLSearchParams(location.search);

const requestedFrameCount = Number(params.get("frames")) || DEFAULT_FRAME_COUNT;
const targetFrameCount = clampFrameCount(requestedFrameCount, window.innerWidth);

const requestedFrameSizes = params.get("frameSizes");
const enabledFrameSizes: FrameSizeId[] = requestedFrameSizes
  ? (requestedFrameSizes.split(",").filter(Boolean) as FrameSizeId[])
  : DEFAULT_FRAME_SIZES;

const config: EngineConfig = {
  liveVideoBudget: 2,
  minCycleMs: 8000,
  maxCycleMs: 20000,
  livenessRotateMs: 25000,
  debugHud: params.get("hud") !== "0",
  targetFrameCount,
  enabledFrameSizes,
};

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element");

const manifest = loadMockManifest();
const wall = new Wall(root, manifest, config);
wall.start();

const platform = detectPlatform();
document.getElementById("platform-badge")?.replaceChildren(`platform: ${platform}`);

// The wall is always animating (crossfades, Ken-Burns pans, rotating live
// video) — never a static frame — so it's reasonable to suppress Tizen's
// own burn-in screensaver while active, the same way a video app would.
// webOS's equivalent (Gallery/"Type 3" screensaver mode) is declared
// statically in appinfo.json instead of via a runtime call — see
// docs/ARCHITECTURE.md §5.6 and platform/webos/appinfo.json.
if (platform === "tizen") suppressTizenSystemScreenSaver();

const exitOverlay = document.getElementById("exit-overlay");
let resumeTimer: number | null = null;

initRemoteInput(() => {
  exitOverlay?.classList.add("is-visible");
  if (platform === "tizen") exitTizenApp();
  if (platform === "webos") exitWebosApp();

  // A real TV OS tears the screensaver down entirely on exit. This
  // browser-based prototype instead simulates "the TV woke up" and
  // re-arms the wall shortly after, so the demo stays explorable instead
  // of ending permanently on the first click/keypress.
  if (resumeTimer !== null) window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(() => {
    exitOverlay?.classList.remove("is-visible");
  }, 2200);
});
