import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup/setupFile.js'],
    globalSetup: ['./tests/setup/globalSetup.js'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 180_000,
    testTimeout: 120_000,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        'src/utils/redis.js',
        '**/node_modules/**',
      ],
      // Stretch goal: push coverage toward 100% as suites expand.
      thresholds: {
        statements: 70,
        functions: 70,
        branches: 55,
        lines: 70,
      },
    },
  },
})
