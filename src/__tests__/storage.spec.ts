import { beforeEach } from 'node:test';
import { describe, expect, it } from 'vitest';
import { getStorage } from '../index.js';

describe('store plugin data', () => {
  beforeEach(() => getStorage('plugin').reset());

  it('should read and write an item by key', () => {
    const { get, set, has, remove } = getStorage('plugin');
    const expected = { name: 'abc', value: 123 };

    expect(set('read-and-write', expected)).toBe(true);
    expect(has('read-and-write')).toBe(true);
    expect(get('read-and-write')).toEqual(expected);
    expect(remove('read-and-write')).toBe(true);
    expect(has('read-and-write')).toBe(false);
  });

  it('should remove item by key', () => {
    const { get, set, remove } = getStorage('plugin');
    set('remove-by-key', {});
    remove('remove-by-key');

    const value = get('remove-by-key');

    expect(value).toBe(null);
  });

  it('should update an item by key', () => {
    const { get, set, update, remove } = getStorage('plugin');
    const joe = { name: 'joe', age: 31 };

    set('person', joe);
    update('person', { age: 40 });

    expect(get('person')).toEqual({ name: 'joe', age: 40 });
  });

  it('should handle multiple items', () => {
    const { set, reset, has, remove, getAll } = getStorage('plugin');
    const one = { name: 'abc', value: 123 };
    const two = { name: 'def', value: 456 };

    reset();
    expect(getAll()).toEqual([]);

    set('abc', one);
    set('def', two);

    expect(getAll()).toEqual([one, two]);

    remove('abc');
    expect(has('abc')).toBe(false);
    expect(getAll()).toEqual([two]);

    remove('def');
    expect(getAll()).toEqual([]);
  });
});
