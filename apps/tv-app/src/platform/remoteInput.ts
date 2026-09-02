/**
 * Platform-agnostic remote-control handling (docs/ARCHITECTURE.md §5.6).
 *
 * A screensaver's #1 UX requirement: *any* remote input must dismiss it
 * instantly. The rendering engine (Wall/Frame/Scheduler) knows nothing
 * about Tizen/webOS key codes — it just gets an `onExitRequested`
 * callback. Platform-specific lifecycle (actually telling the OS the
 * screensaver is done) lives in `tizen.ts`/`webos.ts`.
 */

export type Platform = "tizen" | "webos" | "browser";

declare global {
  interface Window {
    tizen?: unknown;
    webOSSystem?: unknown;
    webOS?: unknown;
  }
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "browser";
  if (window.tizen) return "tizen";
  if (window.webOSSystem || window.webOS) return "webos";
  return "browser";
}

export function initRemoteInput(onExitRequested: () => void): () => void {
  // Standard keydown covers browser + both TV WebKit runtimes; Tizen also
  // fires a `tizenhwkey` event for the hardware Back/Return key, which
  // doesn't always surface as a normal keydown.
  const handleKeydown = (_event: KeyboardEvent) => onExitRequested();
  const handleTizenHwKey = (_event: Event) => onExitRequested();
  const handlePointer = () => onExitRequested();

  document.addEventListener("keydown", handleKeydown, { passive: true });
  document.addEventListener("tizenhwkey", handleTizenHwKey as EventListener, { passive: true });
  // Mouse/touch also counts as "user is back" on platforms that support it
  // (e.g. testing in a desktop browser, or Android TV touch remotes).
  document.addEventListener("pointerdown", handlePointer, { passive: true });

  return () => {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("tizenhwkey", handleTizenHwKey as EventListener);
    document.removeEventListener("pointerdown", handlePointer);
  };
}
