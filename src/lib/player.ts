export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    let id = localStorage.getItem('vanish_xo_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('vanish_xo_player_id', id);
    }
    return id;
  } catch {
    return 'p_' + Math.random().toString(36).substring(2, 11);
  }
}

export { getRealtimeHost } from './config';
