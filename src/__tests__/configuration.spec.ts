import { getConfig } from '../index.js';
import { describe, expect, it, vi } from 'vitest';

describe('configuration', () => {
  const cwd = process.cwd();

  describe('load module configurations', () => {
    it('should return an empty object if no configuration file exists', async () => {
      vi.spyOn(process, 'cwd').mockImplementation(() => cwd);
      const config = await getConfig('plugin');
      expect(config).toEqual({});
    });

    it('should merge configurations and defaults', async () => {
      vi.spyOn(process, 'cwd').mockImplementation(() => cwd);
      const config = await getConfig('plugin', { foo: true });
      expect(config).toEqual({ foo: true });
    });

    it('should load module configurations', async () => {
      vi.spyOn(process, 'cwd').mockImplementation(() => cwd + '/src/__tests__');
      const config = await getConfig('plugin');

      expect(config).toEqual({ foo: true });
    });
  });
});
