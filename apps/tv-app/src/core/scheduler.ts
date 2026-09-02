import { FRAME_SIZE_CATALOG } from "./frameSizes";
import type { EngineConfig, FrameSlot, MediaItem } from "./types";

/**
 * Drives independent per-frame transition timers plus the "live video
 * budget" that keeps concurrent <video> decodes within what real TV
 * hardware can sustain (docs/ARCHITECTURE.md §5.2).
 *
 * Only `config.liveVideoBudget` frames are ever allowed to be in "live"
 * (video) mode at once; everyone else cycles through photos with a
 * (nearly free) Ken-Burns pan/zoom. Liveness slowly rotates to different
 * frames over time so the *feeling* of live video moves around the wall,
 * without ever exceeding the decoder budget. Rotation is "soft": a frame
 * only actually changes mode at its own next natural transition, so video
 * playback is never cut off mid-loop.
 *
 * Media assignment also prefers matching each slot's selected frame size
 * (docs/ARCHITECTURE.md's "let users select frame sizes" feature,
 * `frameSizes.ts`) — a 9:16 vertical clip preferentially lands in a 9:16
 * slot rather than a squarer one, to avoid unnecessarily aggressive
 * cropping — falling back gracefully when no match exists.
 */

export type AssignCallback = (frameId: string, media: MediaItem, isLive: boolean) => void;

interface FrameRuntime {
  frameId: string;
  timer: ReturnType<typeof setTimeout> | null;
  currentMediaId: string | null;
}

export interface SchedulerDebugInfo {
  liveCount: number;
  liveBudget: number;
  frameCount: number;
}

export class MediaScheduler {
  private readonly runtimes = new Map<string, FrameRuntime>();
  private readonly slotsById = new Map<string, FrameSlot>();
  private readonly liveSet = new Set<string>();
  private readonly activeMediaByFrame = new Map<string, string>();
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly slots: FrameSlot[],
    private readonly mediaPool: MediaItem[],
    private readonly config: EngineConfig,
    private readonly onAssign: AssignCallback
  ) {
    for (const slot of slots) {
      this.runtimes.set(slot.id, { frameId: slot.id, timer: null, currentMediaId: null });
      this.slotsById.set(slot.id, slot);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const frameIds = this.slots.map((s) => s.id);
    const budget = Math.min(this.config.liveVideoBudget, frameIds.length);
    const initialLive = pickRandomSubset(frameIds, budget);
    for (const id of initialLive) this.liveSet.add(id);

    // Stagger startup so the whole wall doesn't "wake up" in lockstep.
    for (const slot of this.slots) {
      const startDelay = Math.random() * 3500;
      this.scheduleNext(slot.id, startDelay);
    }

    this.scheduleRotate();
  }

  stop(): void {
    this.running = false;
    for (const rt of this.runtimes.values()) {
      if (rt.timer) clearTimeout(rt.timer);
    }
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
  }

  getDebugInfo(): SchedulerDebugInfo {
    return {
      liveCount: this.liveSet.size,
      liveBudget: this.config.liveVideoBudget,
      frameCount: this.slots.length,
    };
  }

  private scheduleNext(frameId: string, delayMs: number): void {
    const rt = this.runtimes.get(frameId);
    if (!rt) return;
    rt.timer = setTimeout(() => this.cycle(frameId), delayMs);
  }

  private cycle(frameId: string): void {
    const rt = this.runtimes.get(frameId);
    if (!rt) return;

    const wantsLive = this.liveSet.has(frameId);
    const media = this.pickMedia(frameId, wantsLive);
    const isLive = wantsLive && media.kind === "video";

    if (rt.currentMediaId) this.activeMediaByFrame.delete(frameId);
    this.activeMediaByFrame.set(frameId, media.id);
    rt.currentMediaId = media.id;

    this.onAssign(frameId, media, isLive);

    const dwell = isLive
      ? randomBetween(this.config.maxCycleMs * 0.8, this.config.maxCycleMs * 1.6)
      : randomBetween(this.config.minCycleMs, this.config.maxCycleMs);

    this.scheduleNext(frameId, dwell);
  }

  private pickMedia(frameId: string, wantsLive: boolean): MediaItem {
    const currentId = this.activeMediaByFrame.get(frameId) ?? null;
    const inUse = new Set(this.activeMediaByFrame.values());
    if (currentId) inUse.delete(currentId);

    const slot = this.slotsById.get(frameId);
    const wantKind: MediaItem["kind"] = wantsLive ? "video" : "photo";

    const preferred = this.rankByFrameSizeFit(
      this.mediaPool.filter((m) => m.kind === wantKind && !inUse.has(m.id) && m.id !== currentId),
      slot
    );
    if (preferred.length > 0) return preferred[Math.floor(Math.random() * preferred.length)];

    // Fall back: allow reusing an in-use item of the desired kind rather
    // than showing nothing (small demo pools can exhaust quickly).
    const anyOfKind = this.rankByFrameSizeFit(
      this.mediaPool.filter((m) => m.kind === wantKind && m.id !== currentId),
      slot
    );
    if (anyOfKind.length > 0) return anyOfKind[Math.floor(Math.random() * anyOfKind.length)];

    // Last resort: any unused item regardless of kind (e.g. no videos
    // generated because ffmpeg wasn't available at asset-build time).
    const anyUnused = this.mediaPool.filter((m) => !inUse.has(m.id) && m.id !== currentId);
    const pool = anyUnused.length > 0 ? anyUnused : this.mediaPool;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Narrows `items` to those whose selected frame size best fits `slot`:
   * exact match first, then same shape family (portrait/landscape/square),
   * falling back to the full list untouched if nothing fits better. */
  private rankByFrameSizeFit(items: MediaItem[], slot: FrameSlot | undefined): MediaItem[] {
    if (!slot || items.length === 0) return items;

    const exact = items.filter((m) => m.frameSize === slot.frameSizeId);
    if (exact.length > 0) return exact;

    const slotFamily = FRAME_SIZE_CATALOG[slot.frameSizeId]?.shapeFamily;
    const sameFamily = items.filter((m) => FRAME_SIZE_CATALOG[m.frameSize]?.shapeFamily === slotFamily);
    return sameFamily.length > 0 ? sameFamily : items;
  }

  private scheduleRotate(): void {
    const jitter = randomBetween(this.config.livenessRotateMs * 0.7, this.config.livenessRotateMs * 1.3);
    this.rotateTimer = setTimeout(() => {
      this.rotate();
      this.scheduleRotate();
    }, jitter);
  }

  private rotate(): void {
    const budget = Math.min(this.config.liveVideoBudget, this.slots.length);
    if (budget <= 0 || budget >= this.slots.length) return;

    const allIds = this.slots.map((s) => s.id);
    const eligibleToPromote = allIds.filter((id) => !this.liveSet.has(id));
    if (eligibleToPromote.length === 0) return;

    // Demote one currently-live frame (it'll finish its own transition
    // naturally, then pick up photo mode next time it cycles).
    const liveArr = Array.from(this.liveSet);
    const demote = liveArr[Math.floor(Math.random() * liveArr.length)];
    this.liveSet.delete(demote);

    const promote = eligibleToPromote[Math.floor(Math.random() * eligibleToPromote.length)];
    this.liveSet.add(promote);
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandomSubset<T>(items: T[], count: number): T[] {
  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
