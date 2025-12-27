/**
 * Jest configuration for Signalist Bot tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/lib/signalist-bot/__tests__',
    '<rootDir>/lib/services/__tests__',
    '<rootDir>/lib/auto-trading/__tests__',
  ],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/signalist-bot/**/*.ts',
    'lib/services/**/*.ts',
    'lib/auto-trading/**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/*.examples.ts',
    '!**/*.example.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
};









