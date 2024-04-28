import { getStorage } from '../index.js';
import { describe, it, expect } from 'vitest';

describe('store plugin data', () => {
  const { get, set, remove, getAll } = getStorage('plugin');

  it('should read and write an item by plugin name and id', async () => {
    const expected = { name: 'abc', value: 123 };
    await set('abc', expected);
    const value = await get('abc');

    expect(value).toEqual(expected);
  });

  it('should read and write an item by plugin name and id', async () => {
    await set('abc', {});
    await remove('abc');
    const value = await get('abc');

    expect(value).toBe(null);
  });

  it('should read and write an item by plugin name and id', async () => {
    const one = { name: 'abc', value: 123 };
    const two = { name: 'def', value: 456 };

    await set('abc', one);
    await set('def', two);

    expect(await getAll()).toEqual([one, two]);

    await remove('abc');
    expect(await getAll()).toEqual([two]);

    await remove('def');
    expect(await getAll()).toEqual([]);
  });
});
