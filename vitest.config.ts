import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        // No executable surface: barrels, type-only modules, CLI bootstrap, fixtures
        'src/index.ts',
        'src/cli/index.ts',
        'src/docspec/types.ts',
        'src/manifest/types.ts',
        '**/__fixtures__/**',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 87,
        branches: 77,
        functions: 92,
        lines: 87,
      },
    },
  },
});
