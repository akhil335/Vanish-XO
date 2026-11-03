import { track as vercelTrack } from '@vercel/analytics';

export type AllowedPropertyValues = string | number | boolean | null | undefined;

let pageLoadTimestamp = Date.now();
let hasTrackedFirstMove = false;

// Session summary state
let hasSentSessionSummary = false;
let sessionGamesStarted = false;
let sessionGamesPlayed = 0;
let lastInteractionTimestamp = 0;
let accumulatedActiveSeconds = 0;
let lastTickTimestamp = 0;
let activeIntervalId: ReturnType<typeof setInterval> | null = null;
let isSessionAnalyticsInitialized = false;

export function recordGameStarted(): void {
  try {
    sessionGamesStarted = true;
  } catch { }
}

export function recordGamePlayed(): void {
  try {
    sessionGamesPlayed += 1;
  } catch { }
}

export function getSessionSummaryData(): {
  active_seconds: number;
  games_played: number;
  game_started: boolean;
} {
  return {
    active_seconds: Math.round(accumulatedActiveSeconds),
    games_played: sessionGamesPlayed,
    game_started: sessionGamesStarted,
  };
}

export function resetSessionAnalyticsForTesting(): void {
  hasTrackedFirstMove = false;
  hasSentSessionSummary = false;
  sessionGamesStarted = false;
  sessionGamesPlayed = 0;
  lastInteractionTimestamp = 0;
  accumulatedActiveSeconds = 0;
  lastTickTimestamp = 0;
  pageLoadTimestamp = Date.now();
  if (activeIntervalId) {
    clearInterval(activeIntervalId);
    activeIntervalId = null;
  }
}

/**
 * Universal wrapper around track().
 * - Never throws any errors.
 * - In development, does nothing.
 * - Automatically keeps track of games started and games played for session summary.
 */
export function track(
  name: string,
  properties?: Record<string, AllowedPropertyValues>
): void {
  try {
    if (name === 'game_started') {
      recordGameStarted();
    } else if (name === 'game_finished') {
      recordGamePlayed();
    }

    if (process.env.NODE_ENV === 'development') {
      return;
    }
    vercelTrack(name, properties);
  } catch {
    // Fail silently - analytics must never crash the game
  }
}

export const trackEvent = track;

/**
 * Tracks the player's first move once per visit.
 */
export function trackFirstMove(mode: string): void {
  try {
    if (hasTrackedFirstMove) return;

    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem('vanish_first_move_sent') === 'true') {
          hasTrackedFirstMove = true;
          return;
        }
      } catch { }
    }

    let secondsSinceLoad: number | undefined;
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      secondsSinceLoad = Math.round(performance.now() / 1000);
    } else if (pageLoadTimestamp > 0) {
      secondsSinceLoad = Math.round((Date.now() - pageLoadTimestamp) / 1000);
    }

    if (secondsSinceLoad === undefined || isNaN(secondsSinceLoad) || secondsSinceLoad < 0) {
      return;
    }

    hasTrackedFirstMove = true;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('vanish_first_move_sent', 'true');
      } catch { }
    }

    track('first_move', {
      seconds_since_page_load: secondsSinceLoad,
      mode,
    });
  } catch {
    // Fail silently
  }
}

function flushActiveTime(): void {
  try {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    if (lastTickTimestamp <= 0) return;

    const now = Date.now();
    const elapsedMs = now - lastTickTimestamp;
    lastTickTimestamp = now;

    // Count only time the tab is visible and the user has interacted in the last 30 seconds
    if (lastInteractionTimestamp > 0 && now - lastInteractionTimestamp <= 30000) {
      const elapsedSeconds = Math.max(0, elapsedMs / 1000);
      if (elapsedSeconds > 0 && elapsedSeconds <= 5) {
        accumulatedActiveSeconds += elapsedSeconds;
      }
    }
  } catch { }
}

function startActiveTimer(): void {
  try {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }
    if (activeIntervalId) return;

    lastTickTimestamp = Date.now();
    activeIntervalId = setInterval(() => {
      try {
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
          stopActiveTimer();
          return;
        }
        flushActiveTime();
      } catch {
        stopActiveTimer();
      }
    }, 1000);
  } catch {
    // Fail silently
  }
}

function stopActiveTimer(): void {
  try {
    if (activeIntervalId) {
      clearInterval(activeIntervalId);
      activeIntervalId = null;
    }
  } catch {
    // Fail silently
  }
}

export function onUserInteraction(): void {
  try {
    lastInteractionTimestamp = Date.now();
  } catch { }
}

export function sendSessionSummary(): void {
  try {
    if (hasSentSessionSummary) return;
    hasSentSessionSummary = true;

    flushActiveTime();
    stopActiveTimer();

    const roundedActiveSeconds = Math.round(accumulatedActiveSeconds);
    if (isNaN(roundedActiveSeconds) || roundedActiveSeconds < 0) {
      return;
    }

    const payload = {
      active_seconds: roundedActiveSeconds,
      games_played: sessionGamesPlayed,
      game_started: sessionGamesStarted,
    };

    track('session_summary', payload);
  } catch {
    // Fail silently
  }
}

function handleVisibilityChange(): void {
  try {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      flushActiveTime();
      stopActiveTimer();
      sendSessionSummary();
    } else if (document.visibilityState === 'visible') {
      lastTickTimestamp = Date.now();
      startActiveTimer();
    }
  } catch {
    // Fail silently
  }
}

function handlePageHide(): void {
  try {
    flushActiveTime();
    stopActiveTimer();
    sendSessionSummary();
  } catch {
    // Fail silently
  }
}

export function initSessionAnalytics(): void {
  try {
    if (isSessionAnalyticsInitialized) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    isSessionAnalyticsInitialized = true;

    pageLoadTimestamp = Date.now();
    lastTickTimestamp = Date.now();

    const interactionEvents = ['pointerdown', 'keydown', 'touchstart', 'click'] as const;
    interactionEvents.forEach((evt) => {
      window.addEventListener(evt, onUserInteraction, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    if (document.visibilityState === 'visible') {
      startActiveTimer();
    }
  } catch {
    // Fail silently
  }
}

if (typeof window !== 'undefined') {
  initSessionAnalytics();
}
