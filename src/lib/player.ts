export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    // Check sessionStorage first so different tabs/windows on the same machine get unique player sessions
    let id = sessionStorage.getItem('vanish_xo_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('vanish_xo_player_id', id);
    }
    return id;
  } catch {
    return 'p_' + Math.random().toString(36).substring(2, 11);
  }
}

export { getRealtimeHost } from './config';

const ADJECTIVES = [
  'Neon', 'Cyber', 'Turbo', 'Cosmic', 'Hyper', 'Quantum', 'Shadow', 'Solar',
  'Astral', 'Lunar', 'Glitch', 'Void', 'Echo', 'Spark', 'Blaze', 'Pulse',
  'Flux', 'Frost', 'Nova', 'Zen', 'Vortex', 'Pixel', 'Sonic', 'Phantom',
];

const NOUNS = [
  'Fox', 'Viper', 'Falcon', 'Wolf', 'Raven', 'Lynx', 'Titan', 'Rider',
  'Pilot', 'Knight', 'Blade', 'Ghost', 'Hawk', 'Striker', 'Surge', 'Bolt',
  'Star', 'Panda', 'Tiger', 'Dragon', 'Cobra', 'Otter', 'Eagle', 'Ninja',
];

export function generateGuestName(id: string): string {
  if (!id) return 'NeonFox42';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const absHash = Math.abs(hash);
  const adj = ADJECTIVES[absHash % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(absHash / ADJECTIVES.length) % NOUNS.length];
  const num = (absHash % 90) + 10;
  return `${adj}${noun}${num}`;
}

export function sanitizePlayerName(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  if (cleaned.length < 2) return '';
  return cleaned.slice(0, 16);
}

export function getPlayerName(
  user?: string | { name?: string | null; id?: string | null } | null
): string {
  const userObj = typeof user === 'object' && user !== null ? user : null;
  const userName = typeof user === 'string' ? user : userObj?.name;
  const userId = userObj?.id;
  const isSignedIn = Boolean((userName && userName.trim()) || userId);

  if (typeof window === 'undefined') {
    if (userName && userName.trim()) {
      return sanitizePlayerName(userName) || 'Player';
    }
    return '';
  }

  try {
    if (isSignedIn) {
      // 1. If the signed-in user has edited their display name, use that edited name instead of Google name
      const customKey = userId ? `vanish_xo_custom_name_${userId}` : 'vanish_xo_custom_name';
      const customSaved = localStorage.getItem(customKey) || localStorage.getItem('vanish_xo_custom_name');
      if (customSaved && customSaved.trim()) {
        const sanitizedCustom = sanitizePlayerName(customSaved);
        if (sanitizedCustom) return sanitizedCustom;
      }

      // 2. Otherwise use display name from the session
      if (userName && userName.trim()) {
        const sanitizedGoogle = sanitizePlayerName(userName);
        if (sanitizedGoogle) return sanitizedGoogle;
      }

      return 'Player';
    }

    // When not signed in, keep using the guest name exactly as now
    const guestSaved =
      localStorage.getItem('vanish_xo_guest_name') ||
      localStorage.getItem('vanish_xo_player_name');
    if (guestSaved && guestSaved.trim()) {
      const sanitizedGuest = sanitizePlayerName(guestSaved);
      if (sanitizedGuest) {
        localStorage.setItem('vanish_xo_guest_name', sanitizedGuest);
        return sanitizedGuest;
      }
    }

    const id = getOrCreatePlayerId();
    const guestName = generateGuestName(id);
    localStorage.setItem('vanish_xo_guest_name', guestName);
    localStorage.setItem('vanish_xo_player_name', guestName);
    return guestName;
  } catch {
    return generateGuestName('guest');
  }
}

export function setPlayerName(
  name: string,
  isSignedIn = false,
  userId?: string | null
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sanitized = sanitizePlayerName(name);
    if (!sanitized) return null;

    if (isSignedIn) {
      localStorage.setItem('vanish_xo_custom_name', sanitized);
      if (userId) {
        localStorage.setItem(`vanish_xo_custom_name_${userId}`, sanitized);
      }
    } else {
      localStorage.setItem('vanish_xo_guest_name', sanitized);
      localStorage.setItem('vanish_xo_player_name', sanitized);
    }
    return sanitized;
  } catch {
    return null;
  }
}
