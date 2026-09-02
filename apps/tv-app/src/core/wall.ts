import { Frame } from "./frame";
import { buildMosaicLayout } from "./layout";
import { MediaScheduler } from "./scheduler";
import type { EngineConfig, WallManifest } from "./types";

/**
 * Top-level orchestrator (docs/ARCHITECTURE.md §5.5): builds the mosaic
 * layout, instantiates one Frame per slot, wires up the scheduler, and
 * owns the ambient background + optional debug HUD.
 */
export class Wall {
  private readonly frames = new Map<string, Frame>();
  private readonly scheduler: MediaScheduler;
  private readonly gridEl: HTMLDivElement;
  private hudEl: HTMLDivElement | null = null;
  private hudRaf: number | null = null;
  private hudInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly root: HTMLElement,
    manifest: WallManifest,
    config: EngineConfig
  ) {
    const background = document.createElement("div");
    background.className = "wall__background";
    root.appendChild(background);

    this.gridEl = document.createElement("div");
    this.gridEl.className = "wall__grid";
    root.appendChild(this.gridEl);

    const { slots, grid } = buildMosaicLayout(manifest.layoutSeed, {
      targetFrameCount: config.targetFrameCount,
      enabledFrameSizes: config.enabledFrameSizes,
    });
    this.gridEl.style.setProperty("--grid-cols", String(grid.cols));
    this.gridEl.style.setProperty("--grid-rows", String(grid.rows));

    for (const slot of slots) {
      const frame = new Frame(slot);
      this.frames.set(slot.id, frame);
      this.gridEl.appendChild(frame.root);
    }

    this.scheduler = new MediaScheduler(slots, manifest.media, config, (frameId, media, isLive) => {
      this.frames.get(frameId)?.show(media, isLive);
    });

    if (config.debugHud) this.mountHud();
  }

  start(): void {
    this.scheduler.start();
  }

  destroy(): void {
    this.scheduler.stop();
    if (this.hudRaf !== null) cancelAnimationFrame(this.hudRaf);
    if (this.hudInterval !== null) clearInterval(this.hudInterval);
    this.root.innerHTML = "";
  }

  private mountHud(): void {
    this.hudEl = document.createElement("div");
    this.hudEl.className = "debug-hud";
    this.root.appendChild(this.hudEl);

    let frameCount = 0;
    let lastFpsSample = performance.now();
    let fps = 0;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsSample >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsSample));
        frameCount = 0;
        lastFpsSample = now;
      }
      this.hudRaf = requestAnimationFrame(tick);
      this.renderHud(fps);
    };
    this.hudRaf = requestAnimationFrame(tick);
  }

  private renderHud(fps: number): void {
    if (!this.hudEl) return;
    const info = this.scheduler.getDebugInfo();
    this.hudEl.textContent =
      `FPS: ${fps}  |  Live video: ${info.liveCount}/${info.liveBudget}  |  Frames: ${info.frameCount}`;
  }
}
