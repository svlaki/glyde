import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Extended timeout for LLM calls
    testTimeout: 120000,  // 2 minutes per test
    hookTimeout: 30000,   // 30 seconds for setup/teardown

    // Use forks to avoid rate limiting issues with parallel LLM calls
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Run tests sequentially to avoid rate limits
      },
    },

    // Include TypeScript files
    include: ['**/*.test.ts', '**/*.spec.ts'],

    // Environment setup
    globals: true,

    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
    },
  },

  // ESM support
  esbuild: {
    target: 'node18',
  },
});
