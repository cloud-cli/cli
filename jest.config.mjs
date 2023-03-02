export default {
  transformIgnorePatterns: [],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '\\.[jt]s?$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
};
