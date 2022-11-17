export default {
  preset: 'ts-jest',
  slowTestThreshold: 1,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
