import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/server/**', 'src/shared/**'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 45,
        statements: 75,
      },
    },
  },
});
