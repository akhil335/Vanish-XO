import { Redis } from '@upstash/redis';
import { INITIAL_RATING, calculateElo, BOT_RATINGS } from './elo';

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
            playerName: profile?.name || 'Player',
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
            playerName: profile?.name || 'Player',
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
    playerName: p.name,
    rating: p.rating,
    gamesPlayed: p.gamesPlayed,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
  }));
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
        name: playerName && playerName.trim() ? playerName.trim() : 'Player',
        rating: INITIAL_RATING,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        updatedAt: Date.now(),
      };

  // 2. Determine opponent rating
  let opponentRating = INITIAL_RATING;
  if (opponentId && BOT_RATINGS[opponentId]) {
    opponentRating = BOT_RATINGS[opponentId];
  } else if (opponentId && !opponentId.startsWith('bot')) {
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
