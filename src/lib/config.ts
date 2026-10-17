export interface RealtimeConfig {
  host: string;
  protocol: 'ws' | 'wss';
}

/**
 * Sanitizes a raw host string:
 * - Strips protocols (http://, https://, ws://, wss://)
 * - Strips pathnames and trailing slashes
 * - Strips port numbers unless the host is localhost/127.0.0.1
 */
export function sanitizeRealtimeHost(raw?: string | null): string | null {
  if (!raw) return null;
  let host = raw.trim();
  if (!host) return null;

  // Strip protocol
  host = host.replace(/^(https?|wss?):\/\//i, '');

  // Strip paths / query parameters
  host = host.split('/')[0].split('?')[0].trim();

  // Strip trailing slashes or colons
  host = host.replace(/[/: ]+$/, '');

  // Strip port unless localhost or 127.0.0.1
  if (host.includes(':')) {
    const parts = host.split(':');
    const hostname = parts[0].toLowerCase();
    const port = parts[1];
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${parts[0]}:${port}`;
    }
    return parts[0];
  }

  return host || null;
}

/**
 * Resolves the realtime host and protocol.
 * - Uses NEXT_PUBLIC_REALTIME_HOST if set.
 * - In development, falls back to localhost:8787 with ws://.
 * - In production, logs a console error and returns null if missing.
 * - NEVER falls back to window.location or adds a port in production.
 */
export function getRealtimeConfig(): RealtimeConfig | null {
  const sanitized = sanitizeRealtimeHost(process.env.NEXT_PUBLIC_REALTIME_HOST);

  if (sanitized) {
    const isLocal =
      sanitized.toLowerCase().startsWith('localhost') ||
      sanitized.startsWith('127.0.0.1');
    return {
      host: sanitized,
      protocol: isLocal ? 'ws' : 'wss',
    };
  }

  // Development fallback only: localhost:8787 (wrangler dev)
  if (process.env.NODE_ENV === 'development') {
    return {
      host: 'localhost:8787',
      protocol: 'ws',
    };
  }

  // Production missing host
  console.error(
    '[Vanish XO] NEXT_PUBLIC_REALTIME_HOST is not configured in production. WebSockets unavailable.'
  );
  return null;
}

/**
 * Convenience helper returning just the host string or null.
 */
export function getRealtimeHost(): string | null {
  return getRealtimeConfig()?.host ?? null;
}

/**
 * Resolves the site URL for canonical URLs, Open Graph, sitemap, invite links.
 * Defaults to http://localhost:3000 if NEXT_PUBLIC_SITE_URL is not set.
 */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) {
    return url.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}
