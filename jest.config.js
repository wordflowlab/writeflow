/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      useESM: true,
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleNameMapper: {
    '^@/(.*)\.js$': '<rootDir>/src/$1.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/core/(.*)\.js$': '<rootDir>/src/core/$1.ts',
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/cli/(.*)\.js$': '<rootDir>/src/cli/$1.ts',
    '^@/cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@/tools/(.*)\.js$': '<rootDir>/src/tools/$1.ts',
    '^@/tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@/types/(.*)\.js$': '<rootDir>/src/types/$1.ts',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)\.js$': '<rootDir>/src/utils/$1.ts',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageReporters: ['text', 'json', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  verbose: true,
  testTimeout: 30000
}