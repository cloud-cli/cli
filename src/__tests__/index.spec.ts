import { init } from '../index.js';

describe('init symbol', () => {
  it('should export a symbol for cloud initializers', () => {
    expect(init).toBeDefined();
  });
});