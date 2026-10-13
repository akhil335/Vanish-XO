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

export function getPartyKitHost(): string {
  if (process.env.NEXT_PUBLIC_PARTYKIT_HOST) {
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  }
  if (typeof window !== 'undefined') {
    // If running on local development
    return `${window.location.hostname}:1999`;
  }
  return 'localhost:1999';
}
