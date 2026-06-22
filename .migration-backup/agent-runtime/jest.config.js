module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',            // entry point — covered by integration tests
    '!src/api/server.ts',       // HTTP server — requires live port, integration only
    '!src/api/routes/**/*.ts',  // route handlers — integration tests only
    '!src/adversarial/**/*.ts', // attack-simulator — integration only (needs orchestrator)
    '!src/auth/**/*.ts',        // TEE auth — requires real T3N API key
    '!src/tee-bridge/**/*.ts',  // TEE bridge — TEE infra required
    '!src/federation/**/*.ts',  // A2A protocol — HTTP-dependent
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    // Redirect all @terminal3/* imports to our local mock
    '^@terminal3/(.*)$': '<rootDir>/t3n-sdk-mock/index.js',
  },
  testTimeout: 15000,
};
