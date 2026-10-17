import { track as vercelTrack } from '@vercel/analytics';

export type AllowedPropertyValues = string | number | boolean | null | undefined;

/**
 * Universal wrapper around track().
 * - Never throws any errors.
 * - In development, does nothing.
 * - Easily swappable analytics provider.
 */
export function track(
  name: string,
  properties?: Record<string, AllowedPropertyValues>
): void {
  try {
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    vercelTrack(name, properties);
  } catch {
    // Fail silently - analytics must never crash the game
  }
}

export const trackEvent = track;
