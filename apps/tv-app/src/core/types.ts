/**
 * Shared types for the Momento wall rendering engine.
 *
 * These mirror the backend data model described in
 * docs/ARCHITECTURE.md §3, trimmed to what the renderer actually needs.
 * The real app will fetch a WallManifest from `GET /walls/:id/manifest`;
 * the prototype synthesizes one in `mockMedia.ts`.
 */

export type MediaKind = "photo" | "video";

/**
 * A creator-selected display ratio for one memory (see `frameSizes.ts`).
 * "9:16" and "3:4" are the defaults offered — modern phone content skews
 * vertical (short-form video, portrait photos) — extended symmetrically
 * to "16:9"/"4:3" for the landscape family; "1:1" is square's only option.
 */
export type FrameSizeId = "9:16" | "3:4" | "1:1" | "4:3" | "16:9";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  /** Preview-quality URL, always safe/cheap to preload. */
  thumbnailUrl: string;
  /** Full-quality URL for photos, or a playable source URL for videos. */
  displayUrl: string;
  /** Aspect ratio (width / height) of the source media, for cropping. */
  aspectRatio: number;
  /** The frame size the creator chose to display this memory in. */
  frameSize: FrameSizeId;
  /** 0..1 normalized focal point to anchor Ken-Burns pan/zoom & crops. */
  focalPoint: { x: number; y: number };
  /** Used as an instant-paint placeholder before the asset decodes. */
  dominantColor: string;
  /** Creative caption shown on the frame (all styles, not just Polaroid). */
  label?: string;
}

export type FrameShape = "portrait" | "square" | "landscape" | "panoramic";

export interface FrameStyle {
  id: string;
  /** CSS class applied to the frame border element. */
  className: string;
  /** Display name, e.g. "Gold Ornate". */
  name: string;
}

/** A single slot in the mosaic layout — position/size only, no media yet. */
export interface FrameSlot {
  id: string;
  /** Grid placement, in layout cell units. */
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  shape: FrameShape;
  style: FrameStyle;
  /** The true display ratio this slot renders at (see `frameSizes.ts`) —
   * the frame is centered within its grid cell at this exact ratio via
   * CSS `aspect-ratio` rather than stretched to fill the cell. */
  frameSizeId: FrameSizeId;
  targetRatio: number;
}

export interface WallManifest {
  wallId: string;
  frameStyleKit: string;
  layoutSeed: number;
  media: MediaItem[];
}

/** Tunable knobs — mirrors what would eventually be per-platform config. */
export interface EngineConfig {
  /** Max number of frames allowed to run a live <video> decode at once. */
  liveVideoBudget: number;
  /** Min/max ms between a frame's own transitions (jittered per frame). */
  minCycleMs: number;
  maxCycleMs: number;
  /** How often "liveness" is allowed to rotate to a different frame. */
  livenessRotateMs: number;
  /** Show the on-screen FPS/decoder-budget debug HUD. */
  debugHud: boolean;
  /** How many frames the wall shows at once. Defaults to 8; a future
   * on-device Settings slider would let users raise this, capped by
   * screen size (see `frameSizes.ts`'s `maxRecommendedFrameCount`). */
  targetFrameCount: number;
  /** Which frame-size ratios are available to the mosaic's portrait and
   * landscape slot families (see `frameSizes.ts`). */
  enabledFrameSizes: FrameSizeId[];
}
