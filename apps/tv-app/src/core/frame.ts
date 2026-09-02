import type { FrameSlot, MediaItem } from "./types";

/**
 * Renders one mosaic slot (docs/ARCHITECTURE.md §5.3/§5.4).
 *
 * Each Frame owns exactly two reusable "layers" (DOM subtrees) that are
 * crossfaded between — never created/destroyed per transition, only their
 * inner <img>/<video> element's `src` changes. This is the object-pooling
 * behavior called out in the architecture doc: on a screensaver that runs
 * for hours, avoiding per-transition DOM churn matters a lot more than on a
 * typical web page.
 *
 * Video elements are only created when a frame actually goes "live," and
 * their `src` is cleared (freeing the decoder) the moment the frame cycles
 * back to a photo — see `releaseVideo()`.
 */

const KENBURNS_VARIANTS = ["kb-a", "kb-b", "kb-c", "kb-d"] as const;
const CROSSFADE_MS = 1200;

interface Layer {
  el: HTMLDivElement;
  media: HTMLImageElement | HTMLVideoElement | null;
  kind: "photo" | "video" | null;
  currentUrl: string | null;
}

function createLayer(): Layer {
  const el = document.createElement("div");
  el.className = "frame__layer";
  return { el, media: null, kind: null, currentUrl: null };
}

export class Frame {
  readonly root: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private readonly layers: [Layer, Layer];
  private activeIndex = 0;
  /** Exposed for the debug HUD / scheduler introspection. */
  isLive = false;

  constructor(readonly slot: FrameSlot) {
    this.root = document.createElement("div");
    this.root.className = `frame ${slot.style.className} frame--${slot.shape}`;
    this.root.style.gridColumn = `${slot.col + 1} / span ${slot.colSpan}`;
    this.root.style.gridRow = `${slot.row + 1} / span ${slot.rowSpan}`;

    const mat = document.createElement("div");
    mat.className = "frame__mat";
    // The frame renders at its *true* selected ratio (docs/ARCHITECTURE.md
    // §5.1/frameSizes.ts), centered within its grid cell rather than
    // stretched to fill it — see `.frame__mat`'s `aspect-ratio` in frames.css.
    mat.style.setProperty("--target-ratio", String(slot.targetRatio));

    this.viewport = document.createElement("div");
    this.viewport.className = "frame__viewport";

    this.layers = [createLayer(), createLayer()];
    this.viewport.append(this.layers[0].el, this.layers[1].el);

    this.caption = document.createElement("div");
    this.caption.className = "frame__caption";

    mat.appendChild(this.viewport);
    mat.appendChild(this.caption);
    this.root.appendChild(mat);
  }

  /** Assign new media to display; crossfades from whatever is showing now. */
  show(media: MediaItem, isLive: boolean): void {
    this.isLive = isLive && media.kind === "video";
    const nextIndex = 1 - this.activeIndex;
    const incoming = this.layers[nextIndex];
    const outgoing = this.layers[this.activeIndex];

    incoming.el.style.backgroundColor = media.dominantColor;
    this.mount(incoming, media, this.isLive);
    this.caption.textContent = media.label ?? "";
    this.caption.hidden = !media.label;

    // Trigger the crossfade.
    incoming.el.classList.add("is-active");
    outgoing.el.classList.remove("is-active");

    this.activeIndex = nextIndex;

    // Once the outgoing layer has fully faded, release any video decoder
    // it was holding — this is what keeps the live-video budget honest.
    window.setTimeout(() => this.releaseIfVideo(outgoing), CROSSFADE_MS + 50);
  }

  private mount(layer: Layer, media: MediaItem, live: boolean): void {
    const wantKind: "photo" | "video" = live ? "video" : "photo";

    if (layer.kind !== wantKind || !layer.media) {
      if (layer.media) layer.el.removeChild(layer.media);
      layer.media = wantKind === "video" ? document.createElement("video") : document.createElement("img");
      layer.kind = wantKind;
      layer.el.appendChild(layer.media);
    }

    const posX = `${media.focalPoint.x * 100}%`;
    const posY = `${media.focalPoint.y * 100}%`;
    layer.media.style.objectPosition = `${posX} ${posY}`;

    if (wantKind === "video") {
      const video = layer.media as HTMLVideoElement;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.classList.remove(...KENBURNS_VARIANTS);
      if (layer.currentUrl !== media.displayUrl) {
        video.src = media.displayUrl;
        layer.currentUrl = media.displayUrl;
      }
      void video.play().catch(() => {
        /* Autoplay can be blocked in some browser contexts; the debug HUD
           surfaces this via isLive staying false-equivalent visually. On
           real TV runtimes muted autoplay is reliably permitted. */
      });
    } else {
      const img = layer.media as HTMLImageElement;
      img.decoding = "async";
      img.classList.remove(...KENBURNS_VARIANTS);
      img.src = media.displayUrl;
      img.alt = media.label ?? "";
      layer.currentUrl = media.displayUrl;
      // Restart the Ken-Burns pan/zoom with a randomly chosen direction so
      // consecutive photos in the same frame don't repeat the same move.
      const variant = KENBURNS_VARIANTS[Math.floor(Math.random() * KENBURNS_VARIANTS.length)];
      // Force reflow so re-adding the same variant twice in a row still
      // restarts the CSS animation from frame zero.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      img.offsetWidth;
      img.classList.add(variant);
    }
  }

  private releaseIfVideo(layer: Layer): void {
    if (layer.kind === "video" && layer.media && !layer.el.classList.contains("is-active")) {
      const video = layer.media as HTMLVideoElement;
      video.pause();
      video.removeAttribute("src");
      video.load();
      layer.currentUrl = null;
    }
  }
}
