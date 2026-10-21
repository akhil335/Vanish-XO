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

export function getPlayerName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const name = localStorage.getItem('vanish_xo_player_name');
    return name && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export function setPlayerName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem('vanish_xo_player_name', trimmed);
    }
  } catch {}
}
