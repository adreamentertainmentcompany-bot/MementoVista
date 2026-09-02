import { pickFrameSizeFor } from "./frameSizes";
import { createRng, rngShuffle, type Rng } from "./rng";
import type { FrameShape, FrameSizeId, FrameSlot, FrameStyle } from "./types";

/**
 * Mosaic layout engine (docs/ARCHITECTURE.md §5.1).
 *
 * Fills a grid with frames of varying size/aspect ratio — a gallery-wall
 * mosaic rather than a uniform photo grid — using a deterministic greedy
 * bin-packer: scan cells in reading order, and at the first open cell try
 * candidate shapes (biggest/most interesting first, weighted+shuffled by
 * the seeded RNG) until one fits without overlapping or overflowing the
 * grid. A plain 1x1 always fits, so the grid is always fully covered with
 * no gaps and no overlaps.
 *
 * Grid dimensions are derived from `targetFrameCount` (default 8, see
 * `frameSizes.ts`) rather than fixed, so "how many frames" is a real,
 * tunable setting rather than an emergent side effect.
 */

interface ShapeDef {
  colSpan: number;
  rowSpan: number;
  shape: FrameShape;
  /** Relative likelihood of being tried — bigger/rarer shapes weighted low. */
  weight: number;
}

const SHAPES: ShapeDef[] = [
  { colSpan: 2, rowSpan: 2, shape: "square", weight: 2 },
  { colSpan: 1, rowSpan: 2, shape: "portrait", weight: 3 },
  { colSpan: 2, rowSpan: 1, shape: "landscape", weight: 3 },
  { colSpan: 3, rowSpan: 1, shape: "panoramic", weight: 1 },
  { colSpan: 1, rowSpan: 1, shape: "square", weight: 4 },
];

export const FRAME_STYLES: FrameStyle[] = [
  { id: "gold-ornate", className: "frame-style--gold-ornate", name: "Gold Ornate" },
  { id: "walnut-wood", className: "frame-style--walnut-wood", name: "Walnut Wood" },
  { id: "polaroid", className: "frame-style--polaroid", name: "Polaroid" },
  { id: "modern-metal", className: "frame-style--modern-metal", name: "Modern Metal" },
  { id: "filmstrip", className: "frame-style--filmstrip", name: "Filmstrip" },
];

export interface LayoutGrid {
  cols: number;
  rows: number;
}

export interface MosaicLayoutOptions {
  targetFrameCount?: number;
  enabledFrameSizes?: FrameSizeId[];
}

export interface MosaicLayoutResult {
  slots: FrameSlot[];
  grid: LayoutGrid;
}

/**
 * Grid selection. Rather than a fixed grid (whose frame count is an
 * emergent side effect), we enumerate a small set of plausible grid sizes
 * and pick the one whose *packed* frame count lands closest to the target.
 * `rows` per candidate `cols` is chosen to keep grid cells close to square
 * on a 16:9 canvas (rows ≈ cols / aspect); the exact packing is then
 * sampled per candidate. This makes "how many frames" — the default of 8,
 * and the user-facing count setting — a faithfully-tuned knob instead of
 * a calibration guess.
 */
const AVG_CELLS_PER_FRAME = 1.75;
const MIN_COLS = 3;
const MAX_COLS = 12;
const MIN_ROWS = 2;
const MAX_ROWS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function gridCandidates(targetFrameCount: number): LayoutGrid[] {
  const areaIdeal = Math.max(targetFrameCount, 1) * AVG_CELLS_PER_FRAME;
  const candidates: LayoutGrid[] = [];
  for (let cols = MIN_COLS; cols <= MAX_COLS; cols++) {
    const rows = clamp(Math.round(areaIdeal / cols), MIN_ROWS, MAX_ROWS);
    if (!candidates.some((g) => g.cols === cols && g.rows === rows)) {
      candidates.push({ cols, rows });
    }
  }
  return candidates;
}

/** Weighted, shuffled candidate order — biggest shapes tried first but not
 * deterministically always-first, so the mosaic doesn't look templated. */
function candidateOrder(rng: Rng): ShapeDef[] {
  const bag: ShapeDef[] = [];
  for (const shape of SHAPES) {
    for (let i = 0; i < shape.weight; i++) bag.push(shape);
  }
  // De-dupe while preserving a weighted-random priority order.
  const shuffled = rngShuffle(rng, bag);
  const seen = new Set<ShapeDef>();
  const ordered: ShapeDef[] = [];
  for (const s of shuffled) {
    if (!seen.has(s)) {
      seen.add(s);
      ordered.push(s);
    }
  }
  // Always end with the guaranteed-to-fit fallback.
  const fallback = SHAPES[SHAPES.length - 1];
  if (ordered[ordered.length - 1] !== fallback) {
    ordered.push(fallback);
  }
  return ordered;
}

function fits(occupied: boolean[][], grid: LayoutGrid, r: number, c: number, colSpan: number, rowSpan: number): boolean {
  if (r + rowSpan > grid.rows || c + colSpan > grid.cols) return false;
  for (let rr = r; rr < r + rowSpan; rr++) {
    for (let cc = c; cc < c + colSpan; cc++) {
      if (occupied[rr][cc]) return false;
    }
  }
  return true;
}

function markOccupied(occupied: boolean[][], r: number, c: number, colSpan: number, rowSpan: number): void {
  for (let rr = r; rr < r + rowSpan; rr++) {
    for (let cc = c; cc < c + colSpan; cc++) {
      occupied[rr][cc] = true;
    }
  }
}

/** Panoramic slots aren't part of the user-selectable frame-size catalog
 * (true panoramas vary too much in ratio to standardize) — kept as their
 * own fixed, extra-wide ratio. */
const PANORAMIC_RATIO = 2.1;

function packGrid(seed: number, grid: LayoutGrid, enabledFrameSizes: FrameSizeId[]): FrameSlot[] {
  const rng = createRng(seed);
  const occupied: boolean[][] = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(false));
  const slots: FrameSlot[] = [];
  const chosenByShape = new Map<FrameShape, number>();
  let previousStyle: FrameStyle | null = null;
  let slotIndex = 0;

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (occupied[r][c]) continue;

      // Greedy first-fit tends to fill with 1x1 squares — fine on a big grid
      // where variety wins anyway, but on small walls (the 8-frame default)
      // it degenerates into a uniform grid and never shows a 9:16/3:4 frame.
      // So among the shapes that fit here, pick the one whose *family* has
      // been used least, rebalancing across portrait/landscape/square so the
      // mosaic stays varied and the portrait-frame feature is always on show.
      const fitting = candidateOrder(rng).filter((s) => fits(occupied, grid, r, c, s.colSpan, s.rowSpan));
      const fallback = SHAPES[SHAPES.length - 1];
      const chosen = fitting.reduce(
        (best, s) => {
          const used = chosenByShape.get(s.shape) ?? 0;
          const bestUsed = chosenByShape.get(best.shape) ?? 0;
          return used < bestUsed ? s : best;
        },
        fitting.length > 0 ? fitting[0] : fallback
      );
      markOccupied(occupied, r, c, chosen.colSpan, chosen.rowSpan);
      chosenByShape.set(chosen.shape, (chosenByShape.get(chosen.shape) ?? 0) + 1);

      // Avoid the same frame style as the immediately preceding slot so
      // neighboring frames read as visually distinct, most of the time.
      let style = FRAME_STYLES[Math.floor(rng() * FRAME_STYLES.length)];
      if (style === previousStyle && FRAME_STYLES.length > 1) {
        style = FRAME_STYLES[(FRAME_STYLES.indexOf(style) + 1) % FRAME_STYLES.length];
      }
      previousStyle = style;

      let frameSizeId: FrameSizeId;
      let targetRatio: number;
      if (chosen.shape === "panoramic") {
        frameSizeId = "16:9";
        targetRatio = PANORAMIC_RATIO;
      } else {
        const sizeOption = pickFrameSizeFor(rng, chosen.shape, enabledFrameSizes);
        frameSizeId = sizeOption.id;
        targetRatio = sizeOption.ratio;
      }

      slots.push({
        id: `slot-${slotIndex++}`,
        col: c,
        row: r,
        colSpan: chosen.colSpan,
        rowSpan: chosen.rowSpan,
        shape: chosen.shape,
        style,
        frameSizeId,
        targetRatio,
      });
    }
  }

  return slots;
}

export function buildMosaicLayout(seed: number, options: MosaicLayoutOptions = {}): MosaicLayoutResult {
  const { targetFrameCount = 8, enabledFrameSizes } = options;
  const sizes = enabledFrameSizes ?? ["9:16", "3:4", "16:9", "4:3", "1:1"];

  const candidates = gridCandidates(targetFrameCount).map((grid) => ({
    grid,
    slots: packGrid(seed, grid, sizes),
  }));

  // Strictly minimize how far the packed count is from the target (so the
  // "default to 8" knob is honestly tuned); balanced packing already keeps
  // each candidate's shape mix varied, so no diversity tie-break is needed.
  const best = candidates.reduce((best, c) => {
    const bestErr = Math.abs(best.slots.length - targetFrameCount);
    const cErr = Math.abs(c.slots.length - targetFrameCount);
    if (cErr < bestErr) return c;
    if (cErr > bestErr) return best;
    return c.slots.length < best.slots.length ? c : best;
  }, candidates[0]);

  return { slots: best.slots, grid: best.grid };
}
