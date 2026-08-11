/**
 * The shell's renderer build.
 *
 * A config of its own rather than a mode on the root one: the two builds share
 * no entry, no output and no plugins, and the WEB build's output is compared
 * byte for byte between slices. Anything that could change the root build's
 * graph is a change to that comparison.
 *
 * `outDir` is `dist/`, which is what `src-tauri/tauri.conf.json` names as
 * `frontendDist` — so `tauri::generate_context!` embeds exactly what this
 * writes, and `cargo build` needs this to have been run first.
 */
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
    // The renderer is one module. A vendor split would be three requests over a
    // protocol that is a function call.
    target: 'safari15'
  },
  // The dev server the shell points at when it is run with `tauri dev`.
  server: { port: 5174, strictPort: true }
});
