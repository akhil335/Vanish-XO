import { Redis } from '@upstash/redis';
import { INITIAL_RATING, calculateElo, BOT_RATINGS } from './elo';
import { generateGuestName } from './player';

export interface PlayerLeaderboardProfile {
  id: string;
  name: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface GameResultInput {
  playerId: string;
  playerName?: string;
  opponentId?: string;
  opponentName?: string;
  result?: 'win' | 'loss' | 'draw';
}

// In-memory fallback cache when Redis credentials are not configured in development
const inMemoryProfiles = new Map<string, PlayerLeaderboardProfile>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      return new Redis({ url, token });
    } catch {
      return null;
    }
  }
  return null;
}

const LEADERBOARD_KEY = 'vanish_xo:leaderboard';
const PROFILE_KEY_PREFIX = 'vanish_xo:player:';

export async function getPlayerProfile(playerId: string): Promise<PlayerLeaderboardProfile | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get<PlayerLeaderboardProfile | string>(`${PROFILE_KEY_PREFIX}${playerId}`);
      if (!data) return null;
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    } catch {
      // Fall through to memory
    }
  }
  return inMemoryProfiles.get(playerId) || null;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const redis = getRedis();

  if (redis) {
    try {
      // Fetch top players sorted by rating descending
      const results = await redis.zrange<(string | number)[]>(
        LEADERBOARD_KEY,
        0,
        limit - 1,
        { rev: true, withScores: true }
      );

      if (!results || results.length === 0) {
        return [];
      }

      const entries: LeaderboardEntry[] = [];
      const isObjectArray = typeof results[0] === 'object' && results[0] !== null && 'member' in results[0];

      if (isObjectArray) {
        for (let i = 0; i < results.length; i++) {
          const item = results[i] as unknown as { member: string; score: number };
          const pId = item.member;
          const score = Number(item.score);
          const profile = await getPlayerProfile(pId);
          entries.push({
            rank: i + 1,
            playerId: pId,
            playerName: profile?.name || generateGuestName(pId),
            rating: score,
            gamesPlayed: profile?.gamesPlayed || 1,
            wins: profile?.wins || 0,
            losses: profile?.losses || 0,
            draws: profile?.draws || 0,
          });
        }
      } else {
        // Paired array format [member, score, member, score, ...]
        for (let i = 0; i < results.length; i += 2) {
          const pId = String(results[i]);
          const score = Number(results[i + 1]);
          const profile = await getPlayerProfile(pId);
          entries.push({
            rank: Math.floor(i / 2) + 1,
            playerId: pId,
            playerName: profile?.name || generateGuestName(pId),
            rating: score,
            gamesPlayed: profile?.gamesPlayed || 1,
            wins: profile?.wins || 0,
            losses: profile?.losses || 0,
            draws: profile?.draws || 0,
          });
        }
      }

      return entries;
    } catch (e) {
      console.warn('Error fetching from Upstash Redis, falling back to memory store:', e);
    }
  }

  // Memory fallback
  const allProfiles = Array.from(inMemoryProfiles.values())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  return allProfiles.map((p, idx) => ({
    rank: idx + 1,
    playerId: p.id,
    playerName: p.name || generateGuestName(p.id),
    rating: p.rating,
    gamesPlayed: p.gamesPlayed,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
  }));
}

export async function resetLeaderboard(): Promise<{ success: boolean; clearedCount: number }> {
  inMemoryProfiles.clear();
  const redis = getRedis();
  let clearedCount = 0;
  if (redis) {
    try {
      await redis.del(LEADERBOARD_KEY);
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: `${PROFILE_KEY_PREFIX}*`, count: 100 });
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          clearedCount += keys.length;
        }
      } while (cursor !== '0');
    } catch (e) {
      console.warn('Failed to completely clear Upstash Redis:', e);
    }
  }
  return { success: true, clearedCount };
}

export async function recordGameResult(input: GameResultInput): Promise<{
  success: boolean;
  player: PlayerLeaderboardProfile;
  delta: number;
}> {
  const { playerId, playerName, opponentId, result = 'win' } = input;

  if (!playerId) {
    throw new Error('playerId is required');
  }

  // Reject guest IDs: guests cannot earn Elo or be on the leaderboard
  if (playerId.startsWith('p_') || playerId === 'guest') {
    throw new Error('Guests cannot be ranked on the leaderboard. Sign in to record results.');
  }

  // Games against bot or unverified matches must NEVER change rating or create leaderboard entry
  if (!opponentId || opponentId === 'bot' || opponentId.startsWith('bot') || BOT_RATINGS[opponentId]) {
    throw new Error('Bot games are unrated and cannot be recorded to the leaderboard');
  }

  const redis = getRedis();

  // 1. Get or initialize player profile
  const existing = await getPlayerProfile(playerId);
  const player: PlayerLeaderboardProfile = existing
    ? {
        ...existing,
        name: playerName && playerName.trim() ? playerName.trim() : existing.name,
      }
    : {
        id: playerId,
        name: playerName && playerName.trim() ? playerName.trim() : generateGuestName(playerId),
        rating: INITIAL_RATING,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        updatedAt: Date.now(),
      };

  // 2. Determine opponent rating
  let opponentRating = INITIAL_RATING;
  if (opponentId && !opponentId.startsWith('bot')) {
    const oppProfile = await getPlayerProfile(opponentId);
    if (oppProfile) {
      opponentRating = oppProfile.rating;
    }
  }

  // 3. Compute score & Elo
  const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const { newRatingA, deltaA } = calculateElo(player.rating, opponentRating, score);

  player.rating = newRatingA;
  player.gamesPlayed += 1;
  if (result === 'win') player.wins += 1;
  else if (result === 'loss') player.losses += 1;
  else player.draws += 1;
  player.updatedAt = Date.now();

  // 4. Save to Redis or memory fallback
  if (redis) {
    try {
      await redis.zadd(LEADERBOARD_KEY, { score: player.rating, member: player.id });
      await redis.set(`${PROFILE_KEY_PREFIX}${player.id}`, JSON.stringify(player));
    } catch (e) {
      console.warn('Failed to save to Upstash Redis, saving in memory:', e);
      inMemoryProfiles.set(player.id, player);
    }
  } else {
    inMemoryProfiles.set(player.id, player);
  }

  return {
    success: true,
    player,
    delta: deltaA,
  };
}

// In-memory fallbacks when Redis is not configured
const inMemoryRoomSessions = new Map<string, { userId: string; name: string; isGuest?: boolean }>();
const inMemoryRecordedGames = new Set<string>();

const ROOM_SESSION_PREFIX = 'vanish_xo:room_session:';
const GAME_RECORDED_PREFIX = 'vanish_xo:game_recorded:';

export async function registerRoomPlayerSession(
  roomCode: string,
  seatIndex: number,
  playerId: string,
  userId: string,
  name?: string
): Promise<void> {
  const normCode = roomCode.toUpperCase().trim();
  const sessionData = { userId, name: name || 'Player', isGuest: false };
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${ROOM_SESSION_PREFIX}${normCode}:${seatIndex}`, JSON.stringify(sessionData), { ex: 7200 });
      if (playerId) {
        await redis.set(`${ROOM_SESSION_PREFIX}${normCode}:pid:${playerId}`, JSON.stringify(sessionData), { ex: 7200 });
      }
    } catch (e) {
      console.warn('Redis error in registerRoomPlayerSession:', e);
    }
  }
  inMemoryRoomSessions.set(`${normCode}:${seatIndex}`, sessionData);
  if (playerId) {
    inMemoryRoomSessions.set(`${normCode}:pid:${playerId}`, sessionData);
  }
}

export async function registerRoomGuestSession(
  roomCode: string,
  seatIndex: number,
  playerId: string
): Promise<void> {
  const normCode = roomCode.toUpperCase().trim();
  const sessionData = { userId: playerId || 'guest', name: 'Guest', isGuest: true };
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${ROOM_SESSION_PREFIX}${normCode}:${seatIndex}`, JSON.stringify(sessionData), { ex: 7200 });
      if (playerId) {
        await redis.set(`${ROOM_SESSION_PREFIX}${normCode}:pid:${playerId}`, JSON.stringify(sessionData), { ex: 7200 });
      }
    } catch (e) {
      console.warn('Redis error in registerRoomGuestSession:', e);
    }
  }
  inMemoryRoomSessions.set(`${normCode}:${seatIndex}`, sessionData);
  if (playerId) {
    inMemoryRoomSessions.set(`${normCode}:pid:${playerId}`, sessionData);
  }
}

export async function getRoomSeatUser(
  roomCode: string,
  seatIndex: number,
  playerId?: string
): Promise<{ userId: string; name: string; isGuest?: boolean } | null> {
  const normCode = roomCode.toUpperCase().trim();
  const redis = getRedis();
  if (redis) {
    try {
      if (playerId) {
        const byPid = await redis.get<string | { userId: string; name: string; isGuest?: boolean }>(
          `${ROOM_SESSION_PREFIX}${normCode}:pid:${playerId}`
        );
        if (byPid) {
          return typeof byPid === 'string' ? JSON.parse(byPid) : byPid;
        }
      }
      const bySeat = await redis.get<string | { userId: string; name: string; isGuest?: boolean }>(
        `${ROOM_SESSION_PREFIX}${normCode}:${seatIndex}`
      );
      if (bySeat) {
        return typeof bySeat === 'string' ? JSON.parse(bySeat) : bySeat;
      }
    } catch (e) {
      console.warn('Redis error in getRoomSeatUser:', e);
    }
  }

  if (playerId && inMemoryRoomSessions.has(`${normCode}:pid:${playerId}`)) {
    return inMemoryRoomSessions.get(`${normCode}:pid:${playerId}`) || null;
  }
  return inMemoryRoomSessions.get(`${normCode}:${seatIndex}`) || null;
}

export async function markGameRecorded(gameId: string): Promise<boolean> {
  const key = `${GAME_RECORDED_PREFIX}${gameId}`;
  const redis = getRedis();
  if (redis) {
    try {
      // SET with NX returns 'OK' if set, null if already exists
      const res = await redis.set(key, '1', { nx: true, ex: 86400 });
      return res === 'OK';
    } catch (e) {
      console.warn('Redis error in markGameRecorded:', e);
    }
  }

  if (inMemoryRecordedGames.has(key)) {
    return false;
  }
  inMemoryRecordedGames.add(key);
  return true;
}

export async function recordMatchResult(
  playerAId: string,
  playerAName: string,
  playerBId: string,
  playerBName: string,
  scoreA: number
): Promise<{
  success: boolean;
  playerA: PlayerLeaderboardProfile;
  playerB: PlayerLeaderboardProfile;
  deltaA: number;
  deltaB: number;
}> {
  if (!playerAId || !playerBId) {
    throw new Error('Both player IDs are required to record a ranked match');
  }

  if (
    playerAId.startsWith('p_') || playerAId === 'guest' ||
    playerBId.startsWith('p_') || playerBId === 'guest'
  ) {
    throw new Error('Both players must be signed in to record a ranked match');
  }

  if (playerAId.startsWith('bot') || playerBId.startsWith('bot')) {
    throw new Error('Bot games are unrated and cannot be recorded to the leaderboard');
  }

  // 1. Fetch existing profiles
  const existingA = await getPlayerProfile(playerAId);
  const existingB = await getPlayerProfile(playerBId);

  const playerA: PlayerLeaderboardProfile = existingA
    ? {
        ...existingA,
        name: playerAName && playerAName.trim() ? playerAName.trim() : existingA.name,
      }
    : {
        id: playerAId,
        name: playerAName && playerAName.trim() ? playerAName.trim() : generateGuestName(playerAId),
        rating: INITIAL_RATING,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        updatedAt: Date.now(),
      };

  const playerB: PlayerLeaderboardProfile = existingB
    ? {
        ...existingB,
        name: playerBName && playerBName.trim() ? playerBName.trim() : existingB.name,
      }
    : {
        id: playerBId,
        name: playerBName && playerBName.trim() ? playerBName.trim() : generateGuestName(playerBId),
        rating: INITIAL_RATING,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        updatedAt: Date.now(),
      };

  // 2. Calculate Elo update
  const { newRatingA, newRatingB, deltaA, deltaB } = calculateElo(
    playerA.rating,
    playerB.rating,
    scoreA
  );

  playerA.rating = newRatingA;
  playerA.gamesPlayed += 1;
  if (scoreA === 1) playerA.wins += 1;
  else if (scoreA === 0) playerA.losses += 1;
  else playerA.draws += 1;
  playerA.updatedAt = Date.now();

  playerB.rating = newRatingB;
  playerB.gamesPlayed += 1;
  if (scoreA === 0) playerB.wins += 1;
  else if (scoreA === 1) playerB.losses += 1;
  else playerB.draws += 1;
  playerB.updatedAt = Date.now();

  // 3. Save to Redis or memory store
  const redis = getRedis();
  if (redis) {
    try {
      await Promise.all([
        redis.zadd(LEADERBOARD_KEY, { score: playerA.rating, member: playerA.id }),
        redis.set(`${PROFILE_KEY_PREFIX}${playerA.id}`, JSON.stringify(playerA)),
        redis.zadd(LEADERBOARD_KEY, { score: playerB.rating, member: playerB.id }),
        redis.set(`${PROFILE_KEY_PREFIX}${playerB.id}`, JSON.stringify(playerB)),
      ]);
    } catch (e) {
      console.warn('Failed to save both profiles to Upstash Redis, saving in memory:', e);
      inMemoryProfiles.set(playerA.id, playerA);
      inMemoryProfiles.set(playerB.id, playerB);
    }
  } else {
    inMemoryProfiles.set(playerA.id, playerA);
    inMemoryProfiles.set(playerB.id, playerB);
  }

  return {
    success: true,
    playerA,
    playerB,
    deltaA,
    deltaB,
  };
}
