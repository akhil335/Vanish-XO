import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sanitizeRealtimeHost, getRealtimeConfig, getSiteUrl } from './config';

describe('Vanish XO - Configuration and Host Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('sanitizeRealtimeHost', () => {
    it('strips protocols (https, http, wss, ws)', () => {
      expect(sanitizeRealtimeHost('https://vanish-xo.workers.dev')).toBe('vanish-xo.workers.dev');
      expect(sanitizeRealtimeHost('http://vanish-xo.workers.dev')).toBe('vanish-xo.workers.dev');
      expect(sanitizeRealtimeHost('wss://vanish-xo.workers.dev')).toBe('vanish-xo.workers.dev');
      expect(sanitizeRealtimeHost('ws://vanish-xo.workers.dev')).toBe('vanish-xo.workers.dev');
    });

    it('strips trailing slashes, paths, and query parameters', () => {
      expect(sanitizeRealtimeHost('vanish-xo.workers.dev/')).toBe('vanish-xo.workers.dev');
      expect(sanitizeRealtimeHost('https://vanish-xo.workers.dev/parties/main/test?q=1')).toBe('vanish-xo.workers.dev');
    });

    it('strips non-localhost port numbers in production host values', () => {
      expect(sanitizeRealtimeHost('vanish-xo.workers.dev:443')).toBe('vanish-xo.workers.dev');
      expect(sanitizeRealtimeHost('vanish-xo.workers.dev:8787')).toBe('vanish-xo.workers.dev');
    });

    it('preserves port numbers for localhost and 127.0.0.1', () => {
      expect(sanitizeRealtimeHost('localhost:8787')).toBe('localhost:8787');
      expect(sanitizeRealtimeHost('127.0.0.1:8787')).toBe('127.0.0.1:8787');
      expect(sanitizeRealtimeHost('http://localhost:8787/')).toBe('localhost:8787');
    });

    it('returns null for empty or invalid inputs', () => {
      expect(sanitizeRealtimeHost('')).toBeNull();
      expect(sanitizeRealtimeHost('   ')).toBeNull();
      expect(sanitizeRealtimeHost(null)).toBeNull();
      expect(sanitizeRealtimeHost(undefined)).toBeNull();
    });
  });

  describe('getRealtimeConfig', () => {
    it('returns wss:// for production remote hosts', () => {
      process.env.NEXT_PUBLIC_REALTIME_HOST = 'vanish-xo.custom.workers.dev';
      const config = getRealtimeConfig();
      expect(config).toEqual({
        host: 'vanish-xo.custom.workers.dev',
        protocol: 'wss',
      });
    });

    it('returns ws:// when host is localhost in env', () => {
      process.env.NEXT_PUBLIC_REALTIME_HOST = 'localhost:8787';
      const config = getRealtimeConfig();
      expect(config).toEqual({
        host: 'localhost:8787',
        protocol: 'ws',
      });
    });

    it('falls back to localhost:8787 with ws:// when NODE_ENV is development', () => {
      delete process.env.NEXT_PUBLIC_REALTIME_HOST;
      vi.stubEnv('NODE_ENV', 'development');
      const config = getRealtimeConfig();
      expect(config).toEqual({
        host: 'localhost:8787',
        protocol: 'ws',
      });
      vi.unstubAllEnvs();
    });

    it('returns null and logs console.error when missing in production', () => {
      delete process.env.NEXT_PUBLIC_REALTIME_HOST;
      vi.stubEnv('NODE_ENV', 'production');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const config = getRealtimeConfig();
      expect(config).toBeNull();
      expect(spy).toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });

  describe('getSiteUrl', () => {
    it('returns configured site URL without trailing slash', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://vanishxo.online/';
      expect(getSiteUrl()).toBe('https://vanishxo.online');
    });

    it('falls back to http://localhost:3000 if not set', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(getSiteUrl()).toBe('http://localhost:3000');
    });
  });
});
