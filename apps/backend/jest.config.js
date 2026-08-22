/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testTimeout: 20000, // real Postgres/Redis I/O, not mocks — needs more than Jest's 5s default
};
