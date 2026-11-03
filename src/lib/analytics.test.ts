import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { track as vercelTrack } from '@vercel/analytics';
import { track, trackFirstMove, sendSessionSummary, resetSessionAnalyticsForTesting } from './analytics';

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

describe('Vanish XO - Analytics Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does nothing when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    track('room_created', { players: 2 });
    expect(vercelTrack).not.toHaveBeenCalled();
  });

  it('calls vercel track in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    track('room_created', { players: 3 });
    expect(vercelTrack).toHaveBeenCalledWith('room_created', { players: 3 });
  });

  it('never throws even if vercel track throws', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(vercelTrack).mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    expect(() => {
      track('game_started', { players: 2, bots: 0, mode: 'private' });
    }).not.toThrow();
  });

  it('correctly dispatches all 11 production event types with payload', () => {
    vi.stubEnv('NODE_ENV', 'production');

    track('room_created', { players: 2 });
    track('room_joined', { players: 4, role: 'guest' });
    track('game_started', { players: 2, bots: 1, mode: 'offline' });
    track('game_finished', { players: 2, bots: 0, turns: 7, mode: 'matchmaking' });
    track('rematch_clicked', { mode: 'offline' });
    track('home_clicked', { from: 'gameover' });
    track('invite_shared', { method: 'native' });
    track('matchmaking_started', { players: 3 });
    track('matchmaking_filled_with_bots', { players: 4, humans: 2 });
    track('room_not_found');
    track('server_busy_shown');

    expect(vercelTrack).toHaveBeenCalledTimes(11);
    expect(vercelTrack).toHaveBeenCalledWith('room_created', { players: 2 });
    expect(vercelTrack).toHaveBeenCalledWith('room_joined', { players: 4, role: 'guest' });
    expect(vercelTrack).toHaveBeenCalledWith('game_started', { players: 2, bots: 1, mode: 'offline' });
    expect(vercelTrack).toHaveBeenCalledWith('game_finished', { players: 2, bots: 0, turns: 7, mode: 'matchmaking' });
    expect(vercelTrack).toHaveBeenCalledWith('rematch_clicked', { mode: 'offline' });
    expect(vercelTrack).toHaveBeenCalledWith('home_clicked', { from: 'gameover' });
    expect(vercelTrack).toHaveBeenCalledWith('invite_shared', { method: 'native' });
    expect(vercelTrack).toHaveBeenCalledWith('matchmaking_started', { players: 3 });
    expect(vercelTrack).toHaveBeenCalledWith('matchmaking_filled_with_bots', { players: 4, humans: 2 });
    expect(vercelTrack).toHaveBeenCalledWith('room_not_found', undefined);
    expect(vercelTrack).toHaveBeenCalledWith('server_busy_shown', undefined);
  });

  it('correctly dispatches replay analytics events', () => {
    vi.stubEnv('NODE_ENV', 'production');

    track('replay_opened');
    track('replay_step', { direction: 'back' });
    track('replay_step', { direction: 'forward' });
    track('replay_exited');

    expect(vercelTrack).toHaveBeenCalledWith('replay_opened', undefined);
    expect(vercelTrack).toHaveBeenCalledWith('replay_step', { direction: 'back' });
    expect(vercelTrack).toHaveBeenCalledWith('replay_step', { direction: 'forward' });
    expect(vercelTrack).toHaveBeenCalledWith('replay_exited', undefined);
  });

  describe('Time Measurement Analytics', () => {
    beforeEach(() => {
      resetSessionAnalyticsForTesting();
    });

    it('tracks first_move once per visit with seconds_since_page_load and mode', () => {
      vi.stubEnv('NODE_ENV', 'production');

      trackFirstMove('bot');
      expect(vercelTrack).toHaveBeenCalledTimes(1);
      const [eventName, payload] = vi.mocked(vercelTrack).mock.calls[0];
      expect(eventName).toBe('first_move');
      expect(payload).toHaveProperty('seconds_since_page_load');
      expect(typeof payload?.seconds_since_page_load).toBe('number');
      expect(payload?.mode).toBe('bot');

      // Second attempt should not send again (sent once per visit)
      trackFirstMove('pass');
      expect(vercelTrack).toHaveBeenCalledTimes(1);
    });

    it('tracks game_finished with duration_seconds', () => {
      vi.stubEnv('NODE_ENV', 'production');

      track('game_finished', {
        players: 2,
        bots: 1,
        turns: 8,
        mode: 'offline',
        duration_seconds: 42,
      });

      expect(vercelTrack).toHaveBeenCalledWith('game_finished', {
        players: 2,
        bots: 1,
        turns: 8,
        mode: 'offline',
        duration_seconds: 42,
      });
    });

    it('tracks tutorial_completed and tutorial_skipped with seconds_spent', () => {
      vi.stubEnv('NODE_ENV', 'production');

      track('tutorial_completed', { seconds_spent: 15 });
      track('tutorial_skipped', { seconds_spent: 3 });

      expect(vercelTrack).toHaveBeenCalledWith('tutorial_completed', { seconds_spent: 15 });
      expect(vercelTrack).toHaveBeenCalledWith('tutorial_skipped', { seconds_spent: 3 });
    });

    it('sends session_summary once with active_seconds, games_played, and game_started', () => {
      vi.stubEnv('NODE_ENV', 'production');

      // Trigger a game start and completion to update counters
      track('game_started', { players: 2, bots: 0, mode: 'private' });
      track('game_finished', { players: 2, bots: 0, turns: 6, mode: 'private' });

      sendSessionSummary();
      expect(vercelTrack).toHaveBeenCalledWith('session_summary', {
        active_seconds: 0,
        games_played: 1,
        game_started: true,
      });

      // Subsequent call should not send again (sent once)
      vi.mocked(vercelTrack).mockClear();
      sendSessionSummary();
      expect(vercelTrack).not.toHaveBeenCalled();
    });
  });
});
