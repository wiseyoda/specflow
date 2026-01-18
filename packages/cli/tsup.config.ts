import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node20',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
