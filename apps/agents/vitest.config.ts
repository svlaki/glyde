import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Disable CSS/PostCSS - we're testing Node.js backend code
  css: {
    postcss: {},
  },

  resolve: {
    // Ensure we're resolving from node_modules
    conditions: ['node', 'import', 'module', 'default'],
  },

  // SSR options to handle Node.js modules
  ssr: {
    // Don't externalize these packages - bundle them
    noExternal: [
      'date-fns',
      'date-fns-tz',
      'rrule',
      'supertest',
      '@langchain/core',
      '@langchain/langgraph',
      '@langchain/openai',
      'chrono-node',
      /@getzep/,
    ],
  },

  test: {
    // Extended timeout for LLM calls
    testTimeout: 120000,  // 2 minutes per test
    hookTimeout: 30000,   // 30 seconds for setup/teardown

    // Node.js environment for backend tests
    environment: 'node',

    // Include TypeScript files
    include: ['**/*.test.ts', '**/*.spec.ts'],

    // Environment setup
    globals: true,

    // Load .env file before tests
    setupFiles: ['./src/test-setup.ts'],

    // Server dependency handling (new API)
    server: {
      deps: {
        inline: [
          'date-fns',
          'date-fns-tz',
          'rrule',
          'supertest',
          '@langchain/core',
          '@langchain/langgraph',
          '@langchain/openai',
          'chrono-node',
          /@getzep/,
        ],
      },
    },

    // Pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Avoid rate limits with LLM
      },
    },

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
});
