/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@wms/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@wms/zod-schemas$': '<rootDir>/../../../packages/zod-schemas/src/index.ts',
    '^@wms/db$': '<rootDir>/../../../packages/db/src/index.ts',
  },
};
