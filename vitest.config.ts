import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/renderer.ts', 'src/ui.ts', 'src/data/maps.ts', 'src/data/npcs.ts'],
    },
  },
});
