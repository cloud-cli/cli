import { describe, expect, it, vi } from 'vitest';
import { events, init } from '../index.js';

describe('init symbol', () => {
  it('should export a symbol for cloud initializers', () => {
    expect(init).toBeDefined();
  });
});

describe('events', () => {
  it('should have an event emitter for modules to communicate', () => {
    const spy = vi.fn();
    const foo = { foo: true };
    events.on('test', spy);
    events.emit('test', foo);

    expect(spy).toHaveBeenCalledWith(foo);
  });
});
