#!/usr/bin/env node
/**
 * Generates the three themed demo "wall" posters used on the momento.tv landing page.
 *
 * Each theme is a genuinely different wall so the three demos feel distinct:
 *  - a different mosaic composition (frame sizes, positions, count)
 *  - a different frame-mix (gold / walnut / polaroid / metal / filmstrip)
 *  - a different wall background (warm heirloom / fresh playful / dark gallery)
 *  - a different caption typography (engraved serif / handwritten scrawl / placard)
 *  - each frame holds an illustrated *scene* describing a real memory, so the
 *    walls tell a story instead of showing abstract gradients.
 *
 * When the real concierge demo videos exist, drop them in Marketing/videos/
 * (family-demo.mp4, pet-demo.mp4, travel-demo.mp4) and the page's <video>
 * elements take over — these posters just give the sections presence until then.
 *
 * Usage: node scripts/generate-posters.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "posters");
mkdirSync(OUT, { recursive: true });

const W = 1920;
const H = 1080;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const round = (n) => Math.round(n * 10) / 10;

const SHADOW = `<filter id="shadow" x="-30%" y="-30%" width="180%" height="200%">
  <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.3"/>
</filter>`;

/* ----------------------------------------------------------------
 * Small SVG builders
 * ---------------------------------------------------------------- */
const R = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const C = (cx, cy, r, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const PG = (pts, fill, extra = "") => `<polygon points="${pts}" fill="${fill}" ${extra}/>`;
const PTH = (d, fillOrAttrs = "", extra = "") => {
  const mid = /^#/.test(fillOrAttrs) ? `fill="${fillOrAttrs}"` : fillOrAttrs;
  return `<path d="${d}" ${mid} ${extra}/>`;
};

/* ----------------------------------------------------------------
 * SCENE LIBRARY
 * Each scene draws inside photo bounds (x, y, w, h). Stylized flat-vector
 * "memory photos" — enough for every frame to read as a distinct moment.
 * `pal` is the theme's 8-entry palette.
 * ---------------------------------------------------------------- */
const scenes = {
  /* ---- FAMILY ---- */
  birthday: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[6]) +
    PTH(`M${o.x} ${o.y + o.h * 0.78} h${o.w} v${o.h * 0.22} h-${o.w} z`, p[4]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.72, o.h * 0.22, p[5]) +
    R(o.x + o.w * 0.5 - o.h * 0.09, o.y + o.h * 0.66, o.h * 0.18, o.h * 0.06, p[1]) +
    [0, 1, 2].map((i) => R(o.x + o.w * 0.5 - o.h * 0.12 + i * o.h * 0.06, o.y + o.h * 0.6, Math.max(2, o.h * 0.012), o.h * 0.05, p[3])).join("") +
    C(o.x + o.w * 0.5 - o.h * 0.11, o.y + o.h * 0.6, o.h * 0.032, `${p[0]}aa`) +
    C(o.x + o.w * 0.5 + o.h * 0.05, o.y + o.h * 0.6, o.h * 0.032, `${p[0]}aa`) +
    [0, 1, 2].map((i) => C(o.x + (i % 3) * o.w * 0.18 + o.w * 0.1, o.y + o.h * 0.18 + Math.floor(i / 3) * o.h * 0.12, o.h * 0.014 + (i % 3) * 0.006, `${p[0]}55`)).join(""),

  kidsRun: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.62, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.62, o.w, o.h * 0.38, p[4]) +
    C(o.x + o.w * 0.82, o.y + o.h * 0.2, o.h * 0.12, `${p[0]}aa`) +
    [0, 1, 2].map((i) =>
      C(o.x + o.w * (0.22 + i * 0.26), o.y + o.h * 0.5, o.h * 0.085, i % 2 ? p[5] : p[1]) +
      C(o.x + o.w * (0.22 + i * 0.26), o.y + o.h * 0.42, o.h * 0.055, i === 1 ? p[3] : p[5])
    ).join("") +
    [0.16, 0.4, 0.62, 0.9].map((f) => C(o.x + o.w * f, o.y + o.h * (0.24 + f * 0.1), o.h * 0.005, "#ffffff66")).join(""),

  garden: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.6, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.6, o.w, o.h * 0.4, p[4]) +
    [0, 1, 2].map((i) =>
      PTH(`M${o.x + o.w * (0.22 + i * 0.26)} ${o.y + o.h} v${-o.h * 0.34}`, p[4]) +
      C(o.x + o.w * (0.22 + i * 0.26), o.y + o.h * 0.66, o.h * 0.05, i % 2 ? p[1] : p[0]) +
      C(o.x + o.w * (0.22 + i * 0.26), o.y + o.h * 0.66, o.h * 0.024, p[5])
    ).join("") +
    PG(`${o.x + o.w * 0.62},${o.y + o.h * 0.26} ${o.x + o.w * 0.72},${o.y + o.h * 0.3} ${o.x + o.w * 0.66},${o.y + o.h * 0.34}`, `${p[2]}cc`),

  firstSteps: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.55, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.55, o.w, o.h * 0.45, p[5]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.36, o.h * 0.16, p[1]) +
    C(o.x + o.w * 0.42, o.y + o.h * 0.28, o.h * 0.06, p[3]) +
    C(o.x + o.w * 0.58, o.y + o.h * 0.28, o.h * 0.06, p[3]) +
    [0, 1, 2, 3].map((i) => C(o.x + o.w * (0.3 + i * 0.1), o.y + o.h * 0.68 + i * 0.01, o.h * 0.012, p[2])).join("") +
    R(o.x + o.w * 0.16, o.y + o.h * 0.66, o.w * 0.34, o.h * 0.06, p[0], `rx="${o.h * 0.02}"`) +
    R(o.x + o.w * 0.16, o.y + o.h * 0.78, o.w * 0.3, o.h * 0.06, p[0], `rx="${o.h * 0.02}"`),

  familyLake: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.5, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.5, o.w, o.h * 0.5, p[2]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.4, o.h * 0.16, `${p[0]}bb`) +
    PTH(`M${o.x} ${o.y + o.h * 0.5} L${o.x + o.w * 0.2} ${o.y + o.h * 0.3} L${o.x + o.w * 0.4} ${o.y + o.h * 0.5} L${o.x + o.w * 0.62} ${o.y + o.h * 0.34} L${o.x + o.w} ${o.y + o.h * 0.5}`, p[3], `opacity="0.5"`) +
    PTH(`M${o.x + o.w * 0.5 - o.h * 0.35} ${o.y + o.h * 0.75} l${o.h * 0.7} 0`, "#ffffff44") +
    PTH(`M${o.x + o.w * 0.42} ${o.y + o.h * 0.82} h${o.w * 0.14}`, "#ffffff44") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.66, o.h * 0.06, p[5]) +
    C(o.x + o.w * 0.44, o.y + o.h * 0.6, o.h * 0.03, p[1]) +
    [0.2, 0.35, 0.65, 0.8].map((f) => PTH(`M${o.x + o.w * f} ${o.y + o.h * 0.72} h${o.w * 0.05}`, "#ffffff44")).join(""),

  snowDay: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[2]) +
    C(o.x + o.w * 0.16, o.y + o.h * 0.18, o.h * 0.09, "#ffffffcc") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.78, o.h * 0.17, "#ffffff") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.62, o.h * 0.13, "#ffffff") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.48, o.h * 0.09, "#f2f2f2") +
    R(o.x + o.w * 0.5 - o.h * 0.05, o.y + o.h * 0.6, o.h * 0.1, o.h * 0.035, p[1]) +
    [0.08, 0.2, 0.32, 0.44, 0.58, 0.7, 0.84, 0.94].map((f) => C(o.x + o.w * f, o.y + o.h * (0.08 + ((f * 7) % 0.9)), o.h * 0.006, "#ffffffaa")).join("") +
    R(o.x, o.y + o.h * 0.9, o.w, o.h * 0.1, "#e8e8e8"),

  dinnerTable: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[6]) +
    R(o.x + o.w * 0.5 - o.w * 0.42, o.y + o.h * 0.5, o.w * 0.84, o.h * 0.2, p[4], `rx="${o.h * 0.03}"`) +
    C(o.x + o.w * 0.5 - o.w * 0.3, o.y + o.h * 0.6, o.h * 0.06, "#ffffff") +
    C(o.x + o.w * 0.5 - o.w * 0.12, o.y + o.h * 0.6, o.h * 0.06, "#ffffff") +
    C(o.x + o.w * 0.5 + o.w * 0.12, o.y + o.h * 0.6, o.h * 0.06, "#ffffff") +
    C(o.x + o.w * 0.5 + o.w * 0.3, o.y + o.h * 0.6, o.h * 0.06, "#ffffff") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.2, o.h * 0.05, p[1]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.16, o.h * 0.024, p[0]) +
    R(o.x + o.w * 0.32, o.y, o.w * 0.36, o.h * 0.34, `${p[7]}cc`),

  bedtime: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[2]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.42, o.h * 0.2, `${p[1]}bb`) +
    R(o.x + o.w * 0.16, o.y + o.h * 0.14, o.w * 0.16, o.h * 0.06, `${p[0]}aa`) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.72, o.h * 0.15, p[5]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.7, o.h * 0.17, `${p[5]}88`) +
    C(o.x + o.w * 0.1, o.y + o.h * 0.2, o.h * 0.009, "#ffffff88") +
    C(o.x + o.w * 0.9, o.y + o.h * 0.24, o.h * 0.009, "#ffffff88"),

  /* ---- PET ---- */
  dogRun: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.62, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.62, o.w, o.h * 0.38, p[3]) +
    PTH(`M${o.x + o.w * 0.28} ${o.y + o.h * 0.42} q${o.w * 0.06} ${-o.h * 0.14} ${o.w * 0.14} ${-o.h * 0.04} q${o.w * 0.03} ${o.h * 0.16} -${o.w * 0.06} ${o.h * 0.2} q-${o.w * 0.06} -${o.h * 0.02} -${o.w * 0.08} -${o.h * 0.16} z`, p[1]) +
    C(o.x + o.w * 0.42, o.y + o.h * 0.36, o.h * 0.02, "#333") +
    [3, 4, 5].map((i) => PTH(`M${o.x + o.w * (0.1 + i * 0.2)} ${o.y + o.h * (0.3 + i * 0.08)} h${o.w * 0.08}`, `${p[0]}88`, `stroke-width="${o.h * 0.008}" stroke-linecap="round"`)).join("") +
    C(o.x + o.w * 0.52, o.y + o.h * 0.44, o.h * 0.06, p[0]),

  catSleep: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[2]) +
    C(o.x + o.w * 0.82, o.y + o.h * 0.18, o.h * 0.07, "#f3f0e6") +
    R(o.x + o.w * 0.12, o.y + o.h * 0.2, o.w * 0.76, o.h * 0.46, p[6], `rx="${o.h * 0.04}"`) +
    C(o.x + o.w * 0.34, o.y + o.h * 0.62, o.h * 0.14, p[1]) +
    PG(`${o.x + o.w * 0.34},${o.y + o.h * 0.74} ${o.x + o.w * 0.3},${o.y + o.h * 0.82} ${o.x + o.w * 0.38},${o.y + o.h * 0.76}`, p[1]) +
    PG(`${o.x + o.w * 0.5},${o.y + o.h * 0.74} ${o.x + o.w * 0.47},${o.y + o.h * 0.83} ${o.x + o.w * 0.56},${o.y + o.h * 0.77}`, p[1]) +
    C(o.x + o.w * 0.3, o.y + o.h * 0.5, o.h * 0.008, p[3]),

  birdFlight: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.6, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.6, o.w, o.h * 0.4, p[2]) +
    [0.3, 0.55, 0.8].map((f, i) =>
      PG(`${o.x + o.w * f},${o.y + o.h * (0.18 + i * 0.1)} ${o.x + o.w * f - o.w * 0.04},${o.y + o.h * (0.15 + i * 0.1)} ${o.x + o.w * f},${o.y + o.h * (0.17 + i * 0.1)}`, p[4]) +
      PG(`${o.x + o.w * f},${o.y + o.h * (0.18 + i * 0.1)} ${o.x + o.w * f + o.w * 0.04},${o.y + o.h * (0.15 + i * 0.1)} ${o.x + o.w * f},${o.y + o.h * (0.17 + i * 0.1)}`, p[4])
    ).join("") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.72, o.h * 0.06, p[0]) +
    R(o.x + o.w * 0.5 - o.h * 0.3, o.y + o.h * 0.705, o.h * 0.6, o.h * 0.012, "#ffffffaa") +
    PTH(`M${o.x + o.w * 0.2} ${o.y + o.h * 0.95} L${o.x + o.w * 0.8} ${o.y + o.h * 0.95} L${o.x + o.w * 0.9} ${o.y + o.h} L${o.x + o.w * 0.1} ${o.y + o.h} z`, p[1], `opacity="0.5"`),

  zoomies: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[5]) +
    PTH(`M${o.x + o.w * 0.6} ${o.y + o.h * 0.3} C${o.x + o.w * 0.9} ${o.y + o.h * 0.2} ${o.x + o.w * 0.7} ${o.y + o.h * 0.8} ${o.x + o.w * 0.42} ${o.y + o.h * 0.7}`, `stroke="${p[4]}" stroke-width="${o.h * 0.02}" fill="none" stroke-linecap="round"`) +
    C(o.x + o.w * 0.42, o.y + o.h * 0.7, o.h * 0.05, p[1]) +
    C(o.x + o.w * 0.4, o.y + o.h * 0.63, o.h * 0.03, p[3]) +
    [0.72, 0.56, 0.84, 0.5, 0.3].map((f, i) => C(o.x + o.w * f, o.y + o.h * (0.32 + i * 0.12), o.h * (0.02 + (i % 2) * 0.008), "#ffffff66")).join("") +
    PTH(`M${o.x + o.w * 0.1} ${o.y + o.h * 0.85} q${o.w * 0.3} ${-o.h * 0.12} ${o.w * 0.8} ${-o.h * 0.02}`, `stroke="${p[4]}" stroke-width="${o.h * 0.008}" fill="none" stroke-linecap="round" opacity="0.5"`),

  fetch: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.55, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.55, o.w, o.h * 0.45, p[3]) +
    C(o.x + o.w * 0.18, o.y + o.h * 0.5, o.h * 0.05, p[1]) +
    C(o.x + o.w * 0.15, o.y + o.h * 0.44, o.h * 0.025, p[4]) +
    PTH(`M${o.x + o.w * 0.2} ${o.y + o.h * 0.34} Q${o.x + o.w * 0.5} ${o.y + o.h * 0.1} ${o.x + o.w * 0.82} ${o.y + o.h * 0.3}`, `stroke="${p[4]}" stroke-width="${o.h * 0.02}" fill="none" stroke-dasharray="${o.h * 0.06} ${o.h * 0.04}" stroke-linecap="round"`) +
    R(o.x + o.w * 0.82, o.y + o.h * 0.3, o.h * 0.07, o.h * 0.03, p[0]) +
    PTH(`M${o.x + o.w * 0.1} ${o.y + o.h * 0.94} L${o.x + o.w * 0.4} ${o.y + o.h * 0.94} L${o.x + o.w * 0.3} ${o.y + o.h * 0.78} z`, p[4], `opacity="0.6"`) +
    PTH(`M${o.x + o.w * 0.9} ${o.y + o.h * 0.96} L${o.x + o.w * 0.6} ${o.y + o.h * 0.96} L${o.x + o.w * 0.7} ${o.y + o.h * 0.82} z`, p[4], `opacity="0.6"`),

  lapNaps: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[6]) +
    PTH(`M${o.x} ${o.y + o.h * 0.72} L${o.x + o.w} ${o.y + o.h * 0.6} L${o.x + o.w} ${o.y + o.h} L${o.x} ${o.y + o.h} z`, p[3]) +
    PTH(`M${o.x} ${o.y + o.h * 0.66} L${o.x + o.w} ${o.y + o.h * 0.54} L${o.x + o.w} ${o.y + o.h * 0.78} L${o.x} ${o.y + o.h * 0.9} z`, p[5]) +
    PG(`${o.x + o.w * 0.52},${o.y + o.h * 0.66} ${o.x + o.w * 0.7},${o.y + o.h * 0.5} ${o.x + o.w * 0.5},${o.y + o.h * 0.52}`, `${p[1]}cc`) +
    C(o.x + o.w * 0.3, o.y + o.h * 0.3, o.h * 0.05, p[0]) +
    R(o.x + o.w * 0.2, o.y + o.h * 0.3, o.w * 0.2, o.h * 0.02, p[0]),

  sunnyWindow: (o, p) =>
    R(o.x, o.y, o.w, o.h, "#f6e9c7") +
    R(o.x + o.w * 0.26, o.y, o.w * 0.48, o.h, p[2]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.18, o.h * 0.12, p[0]) +
    PTH(`M${o.x + o.w * 0.26} ${o.y + o.h * 0.98} L${o.x + o.w * 0.22} ${o.y + o.h * 0.82} L${o.x + o.w * 0.34} ${o.y + o.h * 0.84} z`, p[5]) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.9, o.h * 0.12, p[1]) +
    PG(`${o.x + o.w * 0.44},${o.y + o.h * 0.9} ${o.x + o.w * 0.4},${o.y + o.h * 0.99} ${o.x + o.w * 0.49},${o.y + o.h * 0.95}`, p[1]) +
    C(o.x + o.w * 0.6, o.y + o.h * 0.92, o.h * 0.022, p[3]),

  treatHeist: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.6, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.6, o.w, o.h * 0.4, p[3]) +
    C(o.x + o.w * 0.6, o.y + o.h * 0.5, o.h * 0.06, p[1]) +
    C(o.x + o.w * 0.58, o.y + o.h * 0.43, o.h * 0.03, p[4]) +
    PG(`${o.x + o.w * 0.62},${o.y + o.h * 0.42} ${o.x + o.w * 0.7},${o.y + o.h * 0.44} ${o.x + o.w * 0.6},${o.y + o.h * 0.5}`, p[1]) +
    C(o.x + o.w * 0.3, o.y + o.h * 0.5, o.h * 0.018, p[4]) +
    [0.2, 0.26, 0.34].map((f) => C(o.x + o.w * f, o.y + o.h * 0.5, o.h * 0.012, p[0])).join("") +
    PTH(`M${o.x + o.w * 0.72} ${o.y + o.h * 0.28} q${o.w * 0.1} ${-o.h * 0.08} ${o.w * 0.08} ${o.h * 0.1}`, `stroke="${p[0]}88" stroke-width="${o.h * 0.01}" fill="none" stroke-linecap="round"`) +
    C(o.x + o.w * 0.8, o.y + o.h * 0.24, o.h * 0.05, `${p[0]}99`),

  /* ---- TRAVEL ---- */
  sunriseBeach: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.42, p[0]) +
    R(o.x + o.w * 0.18, o.y + o.h * 0.3, o.w * 0.64, o.h * 0.2, `${p[0]}aa`) +
    R(o.x, o.y + o.h * 0.42, o.w, o.h * 0.58, p[2]) +
    R(o.x, o.y + o.h * 0.42, o.w, o.h * 0.02, `${p[0]}aa`) +
    R(o.x + o.w * 0.18, o.y + o.h * 0.6, o.w * 0.64, o.h * 0.02, "#ffffff22") +
    R(o.x + o.w * 0.28, o.y + o.h * 0.72, o.w * 0.44, o.h * 0.018, "#ffffff22") +
    R(o.x, o.y + o.h * 0.84, o.w, o.h * 0.16, p[3]) +
    PTH(`M${o.x} ${o.y + o.h * 0.84} Q${o.x + o.w * 0.5} ${o.y + o.h * 0.8} ${o.x + o.w} ${o.y + o.h * 0.84}`, "#ffffff", `opacity="0.4"`),

  cityDusk: (o, p) =>
    R(o.x, o.y, o.w, o.h, `${p[2]}d9`) +
    R(o.x, o.y + o.h * 0.42, o.w, o.h * 0.58, p[1]) +
    [0.06, 0.18, 0.3, 0.44, 0.56, 0.7, 0.84, 0.93].map((f) =>
      R(o.x + o.w * f, o.y + o.h * (0.22 + ((f * 5) % 0.16)), o.w * 0.09, o.h * 0.38, p[2])
    ).join("") +
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => C(o.x + o.w * 0.16 + (i % 4) * (o.w * 0.2), o.y + o.h * (0.3 + Math.floor(i / 4) * 0.12), 3, `${p[0]}bb`)).join("") +
    C(o.x + o.w * 0.8, o.y + o.h * 0.16, o.h * 0.05, `${p[0]}88`),

  mountainTrail: (o, p) =>
    R(o.x, o.y, o.w, o.h, `url(#${o.gid})`) +
    PTH(`M${o.x} ${o.y + o.h * 0.62} L${o.x + o.w * 0.3} ${o.y + o.h * 0.18} L${o.x + o.w * 0.52} ${o.y + o.h * 0.5} L${o.x + o.w * 0.78} ${o.y + o.h * 0.12} L${o.x + o.w} ${o.y + o.h * 0.55} L${o.x + o.w} ${o.y + o.h} L${o.x} ${o.y + o.h} z`, p[2]) +
    PTH(`M${o.x} ${o.y + o.h * 0.78} L${o.x + o.w * 0.7} ${o.y + o.h * 0.6} L${o.x + o.w * 0.9} ${o.y + o.h * 0.98} L${o.x} ${o.y + o.h * 0.98} z`, p[1]) +
    PTH(`M${o.x + o.w * 0.42} ${o.y + o.h * 0.98} L${o.x + o.w * 0.48} ${o.y + o.h * 0.62} L${o.x + o.w * 0.55} ${o.y + o.h * 0.98} z`, p[3]) +
    [0.1, 0.2, 0.86, 0.94].map((f) =>
      PTH(`M${o.x + o.w * f} ${o.y + o.h * 0.9} l${-o.w * 0.03} ${-o.h * 0.12} h${o.w * 0.07} l${-o.w * 0.03} ${-o.h * 0.1} h${o.w * 0.07}`, p[4])
    ).join("") +
    C(o.x + o.w * 0.78, o.y + o.h * 0.1, o.h * 0.03, `${p[0]}66`),

  fjordFog: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[2]) +
    PTH(`M${o.x} ${o.y + o.h * 0.5} L${o.x + o.w * 0.4} ${o.y + o.h * 0.24} L${o.x + o.w * 0.66} ${o.y + o.h * 0.46} L${o.x + o.w} ${o.y + o.h * 0.26} L${o.x + o.w} ${o.y + o.h * 0.56} L${o.x} ${o.y + o.h * 0.56} z`, p[1]) +
    R(o.x, o.y + o.h * 0.52, o.w, o.h * 0.48, p[2]) +
    PTH(`M${o.x} ${o.y + o.h * 0.56} L${o.x + o.w * 0.4} ${o.y + o.h * 0.38} L${o.x + o.w * 0.66} ${o.y + o.h * 0.54} L${o.x + o.w} ${o.y + o.h * 0.42} L${o.x + o.w} ${o.y + o.h * 0.6} L${o.x} ${o.y + o.h * 0.6} z`, p[3], `opacity="0.7"`) +
    R(o.x, o.y + o.h * 0.66, o.w, o.h * 0.34, `${p[3]}cc`) +
    [0.1, 0.3, 0.5, 0.7].map((i) => R(o.x + o.w * 0.1 + i * o.w * 0.2, o.y + o.h * (0.55 + i * 0.04), o.w * 0.18, o.h * 0.02, "#ffffff33")).join("") +
    C(o.x + o.w * 0.5, o.y + o.h * 0.62, o.h * 0.03, p[0]),

  roadTrip: (o, p) =>
    R(o.x, o.y, o.w, o.h * 0.5, `url(#${o.gid})`) +
    PG(`${o.x} ${o.y + o.h * 0.5} ${o.x + o.w * 0.28} ${o.y + o.h * 0.18} ${o.x + o.w * 0.5} ${o.y + o.h * 0.5} ${o.x + o.w * 0.6} ${o.y + o.h * 0.2} ${o.x + o.w * 0.72} ${o.y + o.h * 0.5} ${o.x + o.w} ${o.y + o.h * 0.32} ${o.x + o.w} ${o.y + o.h * 0.5} z`, p[2], `opacity="0.6"`) +
    C(o.x + o.w * 0.5, o.y + o.h * 0.36, o.h * 0.09, `${p[0]}88`) +
    R(o.x, o.y + o.h * 0.5, o.w, o.h * 0.5, p[1]) +
    PTH(`M${o.x + o.w * 0.14} ${o.y + o.h * 0.5} L${o.x + o.w * 0.24} ${o.y + o.h}`, `${p[3]}cc`) +
    PTH(`M${o.x + o.w * 0.84} ${o.y + o.h * 0.5} L${o.x + o.w * 0.74} ${o.y + o.h}`, `${p[3]}cc`) +
    R(o.x + o.w * 0.5 - o.w * 0.01, o.y + o.h * 0.5, o.w * 0.02, o.h * 0.5, p[0]) +
    [0, 1, 2, 3, 4, 5].map((i) => R(o.x + o.w * 0.4, o.y + o.h * (0.5 + i * 0.06), o.w * 0.2, o.h * 0.012, `${p[0]}66`)).join("") +
    PTH(`M${o.x + o.w * 0.36} ${o.y + o.h * 0.62} L${o.x + o.w * 0.5} ${o.y + o.h * 0.66} L${o.x + o.w * 0.6} ${o.y + o.h * 0.62} L${o.x + o.w * 0.6} ${o.y + o.h * 0.88} L${o.x + o.w * 0.36} ${o.y + o.h * 0.88} z`, p[4]) +
    C(o.x + o.w * 0.36, o.y + o.h * 0.62, o.h * 0.02, p[3]) +
    R(o.x + o.w * 0.4, o.y + o.h * 0.72, o.w * 0.16, o.h * 0.05, p[3]),

  cityNight: (o, p) =>
    R(o.x, o.y, o.w, o.h, p[2]) +
    R(o.x, o.y + o.h * 0.5, o.w, o.h * 0.5, p[1]) +
    [0.08, 0.22, 0.38, 0.54, 0.7, 0.86].map((f) =>
      R(o.x + o.w * f, o.y + o.h * (0.3 + ((f * 3) % 0.14)), o.w * 0.1, o.h * 0.2, p[2])
    ).join("") +
    [0, 1, 2, 3, 4, 5].map((i) => C(o.x + o.w * 0.12 + (i % 3) * (o.w * 0.28), o.y + o.h * (0.36 + Math.floor(i / 3) * 0.12), 3, `${p[0]}cc`)).join("") +
    C(o.x + o.w * 0.8, o.y + o.h * 0.12, o.h * 0.04, `${p[0]}66`),

  lighthouse: (o, p) =>
    R(o.x, o.y, o.w, o.h, `url(#${o.gid})`) +
    R(o.x, o.y + o.h * 0.6, o.w, o.h * 0.4, p[2]) +
    PG(`${o.x} ${o.y + o.h * 0.6} ${o.x + o.w * 0.34} ${o.y + o.h * 0.2} ${o.x + o.w * 0.44} ${o.y + o.h * 0.56} z`, p[4]) +
    R(o.x + o.w * 0.62, o.y + o.h * 0.38, o.w * 0.16, o.h * 0.1, "#f2f0e8", `rx="2"`) +
    R(o.x + o.w * 0.62, o.y + o.h * 0.3, o.w * 0.055, o.h * 0.18, p[1]) +
    PG(`${o.x + o.w * 0.62},${o.y + o.h * 0.52} ${o.x + o.w * 0.7},${o.y + o.h * 0.38} ${o.x + o.w * 0.78},${o.y + o.h * 0.52} z`, p[1]) +
    C(o.x + o.w * 0.3, o.y + o.h * 0.5, o.h * 0.05, p[0]) +
    PG(`${o.x + o.w * 0.5},${o.y + o.h * 0.56} ${o.x + o.w * 0.56},${o.y + o.h * 0.5} ${o.x + o.w * 0.62},${o.y + o.h * 0.56} z`, p[0]),
};

/* ----------------------------------------------------------------
 * PALETTES — one cohesive set per theme.
 * ---------------------------------------------------------------- */
const PAL = {
  family:  ["#f6c177", "#e07a5f", "#5b7a8d", "#8a5a2b", "#3d5a40", "#f8ecd8", "#a5532f", "#e3c9a0"],
  pet:     ["#f4a261", "#e76f51", "#2a9d8f", "#74c0fc", "#c77dff", "#ffd166", "#6d597a", "#fff3e0"],
  travel:  ["#ffe3b0", "#ffb35c", "#1f5f8b", "#3e8ec2", "#b5654a", "#2a3d5c", "#67a5a0", "#4f6d7a"],
};

const SKY = {
  family: ["#ffe3c2", "#f6b58f"],
  pet:    ["#d6f4ff", "#a9dfeb"],
  travel: ["#cfe4f3", "#8fbcd4"],
};

/* ----------------------------------------------------------------
 * THEME DEFINITIONS
 * slot: [x, y, w, h, style, rotationDeg|0, scene, caption, live]
 * ---------------------------------------------------------------- */
const THEMES = {
  family: {
    tag: "Family",
    wallBgA: "#f2e3c8", wallBgB: "#e2c9a0", wallPattern: "damask",
    caption: { family: "Georgia,'Times New Roman',serif", style: "italic", weight: "normal", color: "#f3e2c3" },
    slots: [
      [70, 60, 580, 700, "gold", 0, "birthday", "Seven candles, one wish.", true],
      [700, 60, 640, 350, "walnut", 0, "kidsRun", "The afternoon race, nobody won."],
      [1390, 60, 460, 360, "filmstrip", 0, "garden", "Grandma's garden always has a visitor."],
      [80, 800, 640, 210, "metal", 0, "firstSteps", "FIRST STEPS · EVERY FIRST"],
      [700, 440, 300, 570, "polaroid", -2, "dinnerTable", "half the candles already blown"],
      [1040, 440, 640, 300, "gold", 0, "snowDay", "The world went quiet and white."],
      [1050, 780, 360, 240, "walnut", 0, "bedtime", "Stories, then goodnight."],
    ],
  },
  pet: {
    tag: "Pet",
    wallBgA: "#eef2d7", wallBgB: "#d8e7bf", wallPattern: "paw",
    caption: { family: "'Bradley Hand','Comic Sans MS','Segoe Print',cursive", style: "italic", weight: "normal", color: "#3d3d2a" },
    slots: [
      [90, 130, 300, 370, "polaroid", -3, "dogRun", "zoomies at sonic speed"],
      [430, 70, 280, 360, "polaroid", 2, "catSleep", "windowsill rights, respected"],
      [760, 150, 430, 300, "walnut", -1, "birdFlight", "a leaf? a bird? RACING to find out"],
      [1230, 60, 300, 370, "polaroid", 3, "zoomies", "couch to curtain, new record"],
      [120, 600, 560, 280, "filmstrip", 0, "fetch", "he has strong opinions on fetch", true],
      [720, 500, 320, 400, "polaroid", -2, "lapNaps", "officially a heating pad"],
      [1080, 480, 300, 390, "polaroid", 2, "sunnyWindow", "the good morning spot"],
      [1440, 540, 460, 300, "walnut", 0, "treatHeist", "crime spree · solved · crumbs found"],
    ],
  },
  travel: {
    tag: "Travel",
    wallBgA: "#242c36", wallBgB: "#151a21", wallPattern: "none",
    caption: { family: "'Courier New',monospace", style: "normal", weight: "bold", color: "#f4ead6" },
    slots: [
      [60, 70, 780, 440, "metal", 0, "sunriseBeach", "WAVES AT GOLDEN HOUR"],
      [880, 70, 280, 520, "filmstrip", 0, "cityDusk", "THE CITY, LIT"],
      [1200, 70, 660, 330, "steel", 0, "mountainTrail", "TRAIL 07 — NO AGENDA"],
      [80, 560, 780, 450, "filmstrip", 0, "roadTrip", "THE LONG WAY HOME"],
      [880, 590, 280, 420, "metal", 0, "cityNight", "NEON AFTER DARK", true],
      [1200, 400, 660, 610, "filmstrip", 0, "fjordFog", "FJORD FOG, EARLY"],
    ],
  },
};

/* ----------------------------------------------------------------
 * FRAME RENDERER
 * ---------------------------------------------------------------- */
function renderFrame(theme, slot, idx) {
  const [x0, y0, w, h, style, rot, scene, caption, live] = slot;
  const pal = PAL[theme];
  const tdef = THEMES[theme];
  const gid = `${theme}-g${idx}`;
  const sk = { g: `url(#${gid})`, gid, light: SKY[theme][0] };

  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const rotT = rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : "";
  const parts = [];
  parts.push(`<g${rotT}><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${Math.max(4, h * 0.012)}" fill="#000" opacity="0.16" filter="url(#shadow)"/>`);

  const putScene = (px, py, pw, ph, cover = true) => {
    const g = `${grad(gid, px, py, px + pw, py + ph, SKY[theme][0], SKY[theme][1])}`;
    parts.push(`<defs>${g}</defs>`);
    parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#${gid})"/>`);
    parts.push(scenes[scene]({ ...sk, x: px, y: py, w: pw, h: ph }, pal));
    if (cover) {
      parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#sheen)" opacity="0.16"/>`);
      parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#phvign)" opacity="0.2"/>`);
    }
  };

  const captionColor = tdef.caption.color;
  const putCap = (pyy, size, spacing, color = captionColor) => {
    const estW = caption.length * size * 0.58;
    const fsize = estW > w * 0.8 ? (w * 0.8) / (caption.length * 0.58) : size;
    parts.push(`<text x="${cx}" y="${pyy}" text-anchor="middle" font-family="${tdef.caption.family}" font-style="${tdef.caption.style}" font-weight="${tdef.caption.weight}" font-size="${round(fsize)}" letter-spacing="${spacing}" fill="${color}">${esc(caption)}</text>`);
  };

  switch (style) {
    case "gold": {
      parts.push(R(x0, y0, w, h, "#3a2c1e", `rx="6"`));
      parts.push(`<rect x="${x0 + 10}" y="${y0 + 10}" width="${w - 20}" height="${h - 20}" fill="none" stroke="#c9a24a" stroke-width="7"/>`);
      const px = x0 + 36, py = y0 + 36, pw = w - 72, ph = h - 72;
      putScene(px, py, pw, ph);
      parts.push(R(px, py + ph - ph * 0.3, pw, ph * 0.3, "#000", `opacity="0.32"`));
      putCap(py + ph - ph * 0.15 + 2, 26, "0.5");
      break;
    }
    case "walnut": {
      parts.push(R(x0, y0, w, h, "#4a2f1a", `rx="6"`));
      parts.push(`<rect x="${x0 + 12}" y="${y0 + 12}" width="${w - 24}" height="${h - 24}" fill="none" stroke="#7a5a34" stroke-width="4"/>`);
      const px = x0 + 34, py = y0 + 34, pw = w - 68, ph = h - 68;
      putScene(px, py, pw, ph);
      parts.push(R(px, py + ph - ph * 0.28, pw, ph * 0.28, "#000", `opacity="0.3"`));
      putCap(py + ph - ph * 0.14 + 2, 27, "0.4");
      break;
    }
    case "polaroid": {
      const foot = 42;
      parts.push(R(x0, y0, w, h + foot, "#f9f3e9", `rx="4"`));
      const px = x0 + 14, py = y0 + 14, pw = w - 28, ph = h - 28;
      putScene(px, py, pw, ph);
      putCap(y0 + h + foot / 2 + 1, 17, "0.2", "#4a443a");
      break;
    }
    case "metal": {
      parts.push(R(x0, y0, w, h, "#23282f", `rx="3"`));
      parts.push(R(x0, y0, w, h, "none", `rx="3" stroke="#10131a" stroke-width="2"`));
      const px = x0 + 18, py = y0 + 34, pw = w - 36, ph = h - 64;
      putScene(px, py, pw, ph);
      // placard
      const plW = Math.min(30 + caption.length * 8.2, w - 40);
      parts.push(R(x0 + 14, y0 + 12, plW, 26, "#fffdf4", `rx="3"`));
      parts.push(`<text x="${x0 + 14 + plW / 2}" y="${y0 + 12 + 17}" text-anchor="middle" font-family="'Courier New',monospace" font-weight="bold" font-size="11" letter-spacing="1" fill="#23282f">${esc(caption)}</text>`);
      break;
    }
    case "filmstrip": {
      const sph = Math.max(7, Math.round(h * 0.05));
      parts.push(R(x0, y0, w, h, "#15140f", `rx="3"`));
      for (let sy = y0 + sph * 1.4; sy + sph < y0 + h; sy += sph * 3) {
        parts.push(C(x0 + sph * 1.4, sy, sph * 0.2, "#050504"));
        parts.push(C(x0 + w - sph * 1.4, sy, sph * 0.2, "#050504"));
      }
      const px = x0 + sph * 3.2, py = y0 + sph * 1.2, pw = w - sph * 6.4, ph = h - sph * 2.4;
      putScene(px, py, pw, ph);
      parts.push(R(px, py + ph - ph * 0.28, pw, ph * 0.28, "#000", `opacity="0.36"`));
      putCap(py + ph - ph * 0.14 + 2, 24, "1");
      break;
    }
    case "steel": {
      parts.push(R(x0, y0, w, h, "#3a4350", `rx="4"`));
      parts.push(`<rect x="${x0 + 8}" y="${y0 + 8}" width="${w - 16}" height="${h - 16}" fill="none" stroke="#5e6b7e" stroke-width="2"/>`);
      const px = x0 + 22, py = y0 + 22, pw = w - 44, ph = h - 44;
      putScene(px, py, pw, ph);
      parts.push(R(px, py + ph - ph * 0.26, pw, ph * 0.26, "#000", `opacity="0.3"`));
      putCap(py + ph - ph * 0.13 + 2, 25, "0.6");
      break;
    }
  }

  // "live" hint — a clip timecode on one frame per wall
  if (live) {
    const lbl = `● 0:${Math.max(6, Math.round(caption.length * 0.4) % 40).toString().padStart(2, "0")}`;
    parts.push(`<g${rotT}><rect x="${x0 + 14}" y="${y0 + 14}" width="${66 + 64}" height="20" rx="10" fill="#0d0d0d" opacity="0.75"/>
      <text x="${x0 + 14 + (66 + 64) / 2}" y="${y0 + 14 + 14}" text-anchor="middle" font-family="'Courier New',monospace" font-weight="bold" font-size="11" letter-spacing="1" fill="#ffd9c9">${lbl}</text></g>`);
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

/* ----------------------------------------------------------------
 * WALL BACKGROUNDS
 * ---------------------------------------------------------------- */
function wallBackground(theme) {
  const t = THEMES[theme];
  const g = grad(`${theme}-wall`, 0, 0, W, H, t.wallBgA, t.wallBgB);
  let pattern = "";
  if (t.wallPattern === "damask") {
    pattern = `<pattern id="${theme}-pat" width="130" height="130" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#8a5a2b" stroke-width="1.4" opacity="0.055">
        <circle cx="65" cy="65" r="28"/><circle cx="65" cy="65" r="13"/>
      </g></pattern>`;
  } else if (t.wallPattern === "paw") {
    pattern = `<pattern id="${theme}-pat" width="110" height="110" patternUnits="userSpaceOnUse">
      <g fill="#6d9a5f" opacity="0.07">
        <circle cx="55" cy="55" r="10"/>
        <circle cx="43" cy="41" r="3.6"/><circle cx="55" cy="38" r="3.6"/><circle cx="67" cy="41" r="3.6"/>
      </g></pattern>`;
  }
  return `<defs>${g}${pattern}</defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${theme}-wall)"/>
    ${pattern ? `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${theme}-pat)"/>` : ""}`;
}

const SHARED =
  `<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/>
  </linearGradient>
  <radialGradient id="phvign" cx="50%" cy="50%" r="72%">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/>
  </radialGradient>`;

const grad = (id, x1, y1, x2, y2, c0, c1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    <stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/>
  </linearGradient>`;

function poster(theme) {
  const frames = THEMES[theme].slots.map((s, i) => renderFrame(theme, s, i)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${SHARED}${SHADOW}</defs>
  ${wallBackground(theme)}
  ${frames}
</svg>
`;
}

for (const theme of ["family", "pet", "travel"]) {
  writeFileSync(join(OUT, `${theme}.svg`), poster(theme));
  console.log(`wrote posters/${theme}.svg`);
}