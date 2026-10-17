import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { track as vercelTrack } from '@vercel/analytics';
import { track } from './analytics';

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
});
