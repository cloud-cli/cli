import { describe, expect, it, vi } from 'vitest';
import { loadKey, validateKey } from '../authorization.js';
import { Logger } from '../logger.js';

describe('authorization', () => {
  it('should load a key', async () => {
    const key = await loadKey();
    expect(key).toBe('test-key');
  });

  it('should validate if a request is authorized', async () => {
    const request = { headers: { authorization: 'Bearer test-key' } };
    const response = { writeHead: vi.fn(), end: vi.fn() };
    const settings = { key: 'test-key' };
    const valid = validateKey(request, response, settings);

    expect(valid).toBe(true);
    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });

  it('should log invalid keys and reject response', async () => {
    const log = vi.spyOn(Logger, 'debug');
    const request = { headers: { authorization: 'invalid-key' } };
    const response = { writeHead: vi.fn(), end: vi.fn() };
    const settings = { key: 'test-key', invalidKeyPenalty: 10 };
    const valid = validateKey(request, response, settings);
    await new Promise((r) => setTimeout(r, 50));

    expect(valid).toBe(false);
    expect(response.writeHead).toHaveBeenCalledWith(404, 'Not found');
    expect(response.end).toHaveBeenCalledWith();
    expect(log).toHaveBeenCalledWith('Invalid key: invalid-key, expected test-key');
  });
});
