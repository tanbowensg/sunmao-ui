const path = require('path');
module.exports = {
  ...require('../../config/jest.config'),
  moduleFileExtensions: ['ts', 'js', 'tsx'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: path.resolve(__dirname, '../../config/babel.react.config.js'),
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__tests__/styleMock.js',
  },
  testEnvironment: 'jsdom',
};
