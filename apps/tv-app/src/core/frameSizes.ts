import type { Rng } from "./rng";
import { rngInt } from "./rng";
import type { FrameShape, FrameSizeId } from "./types";

/**
 * Frame size catalog — the "let users select frame sizes" feature.
 *
 * In the real product, a person choosing how to frame a memory picks one
 * of these when adding it to a Wall (companion app, §7 of
 * docs/ARCHITECTURE.md). Two are enabled by default per product
 * direction: **9:16** (vertical/short-form video — TikTok, Reels, Stories
 * — the dominant format for modern phone-shot clips) and **3:4** (the
 * classic portrait-photo ratio). The engine also extends the same
 * selectable-ratio idea to the landscape family (16:9/4:3) for symmetry
 * and variety, though that wasn't explicitly requested.
 *
 * Each option's `shapeFamily` says which mosaic grid-span family
 * (`layout.ts`) it belongs to; the frame is then rendered at its *true*
 * ratio via CSS `aspect-ratio`, centered within that grid cell rather
 * than stretched to fill it — see `frame.ts`/`frames.css`. This means a
 * 9:16 frame genuinely looks tall/narrow and a 3:4 frame genuinely looks
 * "fuller," even when both land in a portrait-shaped grid cell.
 */

export interface FrameSizeOption {
  id: FrameSizeId;
  label: string;
  /** width / height */
  ratio: number;
  shapeFamily: FrameShape;
}

export const FRAME_SIZE_CATALOG: Record<FrameSizeId, FrameSizeOption> = {
  "9:16": { id: "9:16", label: "9:16 — Vertical Video", ratio: 9 / 16, shapeFamily: "portrait" },
  "3:4": { id: "3:4", label: "3:4 — Classic Portrait", ratio: 3 / 4, shapeFamily: "portrait" },
  "1:1": { id: "1:1", label: "1:1 — Square", ratio: 1, shapeFamily: "square" },
  "4:3": { id: "4:3", label: "4:3 — Classic Photo", ratio: 4 / 3, shapeFamily: "landscape" },
  "16:9": { id: "16:9", label: "16:9 — Widescreen", ratio: 16 / 9, shapeFamily: "landscape" },
};

/** Pre-selected/enabled out of the box — see module doc above. */
export const DEFAULT_FRAME_SIZES: FrameSizeId[] = ["9:16", "3:4", "16:9", "4:3"];

export const ALL_FRAME_SIZE_IDS: FrameSizeId[] = ["9:16", "3:4", "1:1", "4:3", "16:9"];

/** Relative likelihood when more than one enabled option fits a slot's
 * shape family — 9:16 weighted higher, reflecting how dominant vertical
 * short-form video is in modern phone-shot content. */
const FRAME_SIZE_WEIGHT: Partial<Record<FrameSizeId, number>> = {
  "9:16": 2,
};

/** Pick a frame size (deterministically, via the layout's seeded rng) from
 * `enabled`, restricted to those belonging to `shapeFamily`. Falls back to
 * the catalog's single canonical option for shape families that aren't
 * user-selectable (currently just "square"). */
export function pickFrameSizeFor(rng: Rng, shapeFamily: FrameShape, enabled: FrameSizeId[]): FrameSizeOption {
  const candidates = enabled
    .map((id) => FRAME_SIZE_CATALOG[id])
    .filter((opt) => opt.shapeFamily === shapeFamily);

  if (candidates.length === 0) {
    const fallback = ALL_FRAME_SIZE_IDS.map((id) => FRAME_SIZE_CATALOG[id]).find(
      (opt) => opt.shapeFamily === shapeFamily
    );
    return fallback ?? FRAME_SIZE_CATALOG["1:1"];
  }

  const weighted: FrameSizeOption[] = [];
  for (const opt of candidates) {
    const weight = FRAME_SIZE_WEIGHT[opt.id] ?? 1;
    for (let i = 0; i < weight; i++) weighted.push(opt);
  }
  return weighted[rngInt(rng, weighted.length)];
}

/**
 * How many frames Momento shows at once, and the range a future on-device
 * Settings slider should offer. Defaults to 8 regardless of screen size;
 * the *ceiling* users can raise it to scales with the detected display, so
 * a 4K set can host a denser wall than a 1080p one before frames feel too
 * small/cluttered to read.
 */
export const DEFAULT_FRAME_COUNT = 8;
export const MIN_FRAME_COUNT = 6;

export function maxRecommendedFrameCount(viewportWidthPx: number): number {
  if (viewportWidthPx >= 3840) return 32; // 4K+
  if (viewportWidthPx >= 2560) return 24; // 1440p
  if (viewportWidthPx >= 1600) return 20; // ~1080p and a bit above
  return 12; // smaller/lower-end panels
}

export function clampFrameCount(count: number, viewportWidthPx: number): number {
  const max = maxRecommendedFrameCount(viewportWidthPx);
  return Math.min(Math.max(Math.round(count), MIN_FRAME_COUNT), max);
}
