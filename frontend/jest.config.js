module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo/virtual/env$': '<rootDir>/test/expoVirtualEnv.js',
    '^expo-updates$': '<rootDir>/test/expoUpdatesMock.js',
  },
};
