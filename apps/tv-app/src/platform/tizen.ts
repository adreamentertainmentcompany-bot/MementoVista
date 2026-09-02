/**
 * Samsung Tizen lifecycle shim. Real Tizen TV apps get `window.tizen` (Web
 * Device API) and `window.webapis` (Samsung Product API, needs
 * `$WEBAPIS/webapis/webapis.js` loaded in index.html) from the platform;
 * here we feature-detect so this file is a harmless no-op in a plain
 * browser during development.
 *
 * Momento is a manually-launched full-screen app, not an OS-registered
 * screensaver (Tizen has no public hook for the latter — see
 * docs/ARCHITECTURE.md §1). What we *do* use: `webapis.appcommon
 * .setScreenSaver()` to suppress the TV's own burn-in screensaver while
 * the wall is actively animating (the same pattern video-playback apps
 * use), and re-enable it if we're ever paused/backgrounded.
 * Ref: https://developer.samsung.com/smarttv/develop/guides/fundamentals/setting-screensaver.html
 */

interface TizenApplicationApi {
  getCurrentApplication(): { exit(): void };
}

interface AppCommonApi {
  AppCommonScreenSaverState: { SCREEN_SAVER_ON: number; SCREEN_SAVER_OFF: number };
  setScreenSaver(
    state: number,
    onsuccess?: (result: unknown) => void,
    onerror?: (error: unknown) => void
  ): void;
}

function getTizen(): { application?: TizenApplicationApi } | undefined {
  return (window as unknown as { tizen?: { application?: TizenApplicationApi } }).tizen;
}

function getAppCommon(): AppCommonApi | undefined {
  return (window as unknown as { webapis?: { appcommon?: AppCommonApi } }).webapis?.appcommon;
}

export function exitTizenApp(): void {
  try {
    getTizen()?.application?.getCurrentApplication().exit();
  } catch {
    // Not running under the real Tizen runtime (e.g. plain browser dev) —
    // nothing to do.
  }
}

/** Call once the wall starts animating (it never shows a static frame). */
export function suppressTizenSystemScreenSaver(): void {
  const appcommon = getAppCommon();
  if (!appcommon) return;
  try {
    appcommon.setScreenSaver(appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
  } catch {
    // Older firmware / not running under Tizen — ignore.
  }
}

/** Call on pause/suspend so we're not left having disabled it forever. */
export function restoreTizenSystemScreenSaver(): void {
  const appcommon = getAppCommon();
  if (!appcommon) return;
  try {
    appcommon.setScreenSaver(appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON);
  } catch {
    // Older firmware / not running under Tizen — ignore.
  }
}
