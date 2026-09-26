/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Resolve workspace packages to their built output (built before tests in CI/turbo).
    '^@vop/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@vop/config$': '<rootDir>/../../packages/config/dist/index.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
  ],
};
