#!/usr/bin/env node
/**
 * Generates placeholder "family memory" media for the prototype so the
 * engine can be demoed without real photos/videos or network access.
 *
 * - Photos: hand-templated SVGs (warm gradient + grain + caption), each at
 *   the exact ratio of the frame size it's assigned in mockMedia.ts (see
 *   src/core/frameSizes.ts's FRAME_SIZE_CATALOG).
 * - Videos: short silent looping clips rendered with ffmpeg's `gradients`
 *   source filter — an abstract drifting-color animation that stands in
 *   for a real home-movie clip without needing any licensed footage.
 *
 * Run with: `node scripts/generate-mock-assets.mjs`
 * (also runs automatically via `npm run dev`/`build` through predev/prebuild)
 *
 * Output metadata (paths, aspect ratio, dominant color, label) must match
 * what `src/core/mockMedia.ts` expects — this script and that file are a
 * matched pair describing the same fixed demo dataset.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_ROOT = join(__dirname, "..", "public", "media");
const PHOTOS_DIR = join(MEDIA_ROOT, "photos");
const VIDEOS_DIR = join(MEDIA_ROOT, "videos");

mkdirSync(PHOTOS_DIR, { recursive: true });
mkdirSync(VIDEOS_DIR, { recursive: true });

// Exact ratios matching src/core/frameSizes.ts's FRAME_SIZE_CATALOG — kept
// in sync deliberately so demo assets genuinely render at their declared
// frame size rather than an approximation of it.
const ASPECTS = {
  "9:16": { w: 810, h: 1440 },
  "3:4": { w: 1050, h: 1400 },
  "1:1": { w: 1200, h: 1200 },
  "4:3": { w: 1400, h: 1050 },
  "16:9": { w: 1600, h: 900 },
};

/** id, label, frame size, two-color warm palette. Captions/frame sizes
 * must match src/core/mockMedia.ts's assignments. */
const PHOTOS = [
  { id: "photo-01", label: "Where the lake kissed the sky", aspect: "4:3", c1: "#f6b26b", c2: "#c65b2e" },
  { id: "photo-02", label: "Backpack bigger than the kid inside it", aspect: "3:4", c1: "#8fb8de", c2: "#3c6b93" },
  { id: "photo-03", label: "Grandma's hands, forever green", aspect: "1:1", c1: "#a3c47a", c2: "#4f7a3d" },
  { id: "photo-04", label: "Seconds before the food fight", aspect: "3:4", c1: "#e6b8a2", c2: "#a85c43" },
  { id: "photo-05", label: "Windows down, nowhere to be", aspect: "16:9", c1: "#f2d06b", c2: "#b5762f" },
  { id: "photo-06", label: "Countdown to forever", aspect: "9:16", c1: "#8a7ec9", c2: "#3f2f6e" },
  { id: "photo-07", label: "Smoke, laughter, one burnt burger", aspect: "4:3", c1: "#e8935c", c2: "#8f3e21" },
  { id: "photo-08", label: "Salt in our hair, sun on our skin", aspect: "1:1", c1: "#7ec3c9", c2: "#276b74" },
  { id: "photo-09", label: "Still in pajamas, already celebrating", aspect: "9:16", c1: "#d98a9c", c2: "#7a2f45" },
  { id: "photo-10", label: "Make a wish", aspect: "1:1", c1: "#f0c14b", c2: "#a3651c" },
  { id: "photo-11", label: "Crunching through golden afternoons", aspect: "4:3", c1: "#c98a4e", c2: "#6e3a1d" },
  { id: "photo-12", label: "The world went quiet and white", aspect: "16:9", c1: "#b9d3e0", c2: "#5b7f92" },
];

/** id, label, frame size, warm palette for the gradients filter. Three of
 * four are vertical (9:16) — most personal video shot today is, on a
 * phone, held upright — with one 16:9 widescreen establishing shot. */
const VIDEOS = [
  { id: "video-01", label: "Confetti, thrown too early", aspect: "9:16", c0: "0xf7c873", c1: "0xb5451f", seed: 11, speed: 0.012 },
  { id: "video-02", label: "The sun said goodnight first", aspect: "9:16", c0: "0xf2a65a", c1: "0x2c5f7c", seed: 27, speed: 0.008 },
  { id: "video-03", label: "Sky full of tiny suns", aspect: "9:16", c0: "0x8a6fd1", c1: "0x2a1f4d", seed: 42, speed: 0.02 },
  { id: "video-04", label: "Where the tomatoes grew wild", aspect: "16:9", c0: "0xa8c97f", c1: "0x3c5a2c", seed: 5, speed: 0.006 },
];

/** Video resolutions kept smaller than the photo SVGs' logical size (these
 * are real encoded pixels, unlike the vector photos) while preserving the
 * exact target ratio. */
const VIDEO_RESOLUTIONS = {
  "9:16": "540x960",
  "16:9": "960x540",
};

function svgPhoto({ w, h, c1, c2, label }) {
  const fontSize = Math.round(w * 0.045);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="85%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" seed="7" />
      <feColorMatrix in="noise" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0" />
    </filter>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="78%" stop-color="#000000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" />
  <rect width="${w}" height="${h}" filter="url(#grain)" />
  <rect width="${w}" height="${h}" fill="url(#vignette)" />
  <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.93)}"
        font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}"
        fill="#fff8ec" fill-opacity="0.92" style="letter-spacing:0.02em">
    ${label}
  </text>
</svg>`;
}

console.log("Generating mock photo assets...");
for (const p of PHOTOS) {
  const { w, h } = ASPECTS[p.aspect];
  const outPath = join(PHOTOS_DIR, `${p.id}.svg`);
  writeFileSync(outPath, svgPhoto({ w, h, c1: p.c1, c2: p.c2, label: p.label }), "utf8");
  console.log(`  wrote ${outPath}`);
}

console.log("Generating mock video assets (ffmpeg required)...");
let ffmpegAvailable = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  ffmpegAvailable = false;
  console.warn(
    "  ffmpeg not found on PATH — skipping video generation.\n" +
      "  Live-video frames will gracefully fall back to photos until\n" +
      "  you install ffmpeg and re-run this script."
  );
}

if (ffmpegAvailable) {
  for (const v of VIDEOS) {
    const outPath = join(VIDEOS_DIR, `${v.id}.mp4`);
    if (existsSync(outPath)) {
      console.log(`  skip ${outPath} (already exists)`);
      continue;
    }
    const durationSec = 8;
    const resolution = VIDEO_RESOLUTIONS[v.aspect];
    const src =
      `gradients=size=${resolution}:rate=30:duration=${durationSec}:` +
      `nb_colors=2:c0=${v.c0}:c1=${v.c1}:type=radial:seed=${v.seed}:speed=${v.speed}`;
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      src,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-profile:v",
      "main",
      "-movflags",
      "+faststart",
      outPath,
    ];
    execFileSync("ffmpeg", args, { stdio: "inherit" });
    console.log(`  wrote ${outPath}`);
  }
}

console.log("Done.");
