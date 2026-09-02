import { defineConfig } from "vite";

// Tizen/webOS runtimes are older WebKit engines living inside a packaged
// app (loaded via file:// once deployed), so we target a conservative
// build: no fancy modern syntax that requires a very recent engine, and
// relative asset paths so the bundle works whether it's served from a
// dev server, a static host, or unpacked inside a .wgt/.ipk on the TV.
export default defineConfig({
  base: "./",
  build: {
    target: "es2017",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
