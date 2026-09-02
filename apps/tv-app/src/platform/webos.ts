/**
 * LG webOS TV lifecycle shim.
 *
 * Momento is a manually-launched full-screen app, not an OS-registered
 * screensaver (webOS has no public "run my app when idle" hook — see
 * docs/ARCHITECTURE.md §1). What we *do* use: the officially-documented
 * **Type 3 / Gallery screensaver mode**, which is declared statically in
 * `appinfo.json` (see `platform/webos/appinfo.json`) — LG's own docs list
 * "a gallery app" as the exact intended use case: it extends the (very
 * short, a few minutes on OLED) idle timeout to 30 minutes and dims the
 * whole screen gradually instead of a hard cutover.
 * Ref: https://webostv.developer.lge.com/develop/guides/screensaver
 *
 * `webOS.platformBack()` (from the separately-loaded `webOSTVjs` helper
 * library) is the documented way to request the platform's exit/back
 * handling; it requires `disableBackHistoryAPI: true` in `appinfo.json`
 * plus listening for the Magic Remote Back key (`keyCode 461`).
 * Ref: https://webostv.developer.lge.com/develop/guides/back-button
 */

interface WebOsHelperLibrary {
  platformBack?: () => void;
}

export function exitWebosApp(): void {
  const webOS = (window as unknown as { webOS?: WebOsHelperLibrary }).webOS;
  try {
    webOS?.platformBack?.();
  } catch {
    // webOSTVjs not loaded (e.g. plain browser dev) — nothing to do.
  }
}
