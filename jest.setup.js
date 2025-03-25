// Mock only what's necessary for basic tests to run
global.__DEV__ = true;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock UUID generation for predictable testing
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Completely suppress console output during tests for cleaner output
// This is fine for CI/testing but would be removed for local debugging
global.console = {
  ...console,
  // Keep native behavior for these methods
  assert: console.assert,
  dir: console.dir,
  trace: console.trace,
  
  // Suppress these outputs
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 