import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';
import { MoveRecord } from './types';
import { createInitialState, placeMark } from './game';
import { generateGuestName } from './player';

export type BotDifficulty = 'medium' | 'hard';

export interface BotLeaderboardRecord {
  playerId: string;
  playerName: string;
  difficulty: BotDifficulty;
  moves: number; // human player moves
  turns: number; // total game turns
  durationSeconds: number;
  completedAt: number;
}

export interface BotLeaderboardEntry extends BotLeaderboardRecord {
  rank: number;
}

export interface SubmitBotGameInput {
  playerId: string;
  playerName?: string;
  difficulty: BotDifficulty;
  history: MoveRecord[];
  durationSeconds: number;
}

export interface SubmitBotGameResult {
  success: boolean;
  isNewRecord: boolean;
  isImprovement: boolean;
  record: BotLeaderboardRecord;
  rank?: number;
  message?: string;
}

// In-memory fallback stores when Redis is not configured (e.g. unit tests or local dev)
const inMemoryBotRecords = new Map<string, BotLeaderboardRecord>();
const inMemoryDeduplication = new Set<string>();

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

export function getBotLeaderboardKey(difficulty: BotDifficulty): string {
  return `vanish_xo:bot_leaderboard:${difficulty}`;
}

export function getBotRecordKey(difficulty: BotDifficulty, playerId: string): string {
  return `vanish_xo:bot_record:${difficulty}:${playerId}`;
}

const BOT_DEDUP_KEY_PREFIX = 'vanish_xo:bot_dedup:';

/**
 * Score formula for Redis Sorted Set (ascending sort):
 * Fewest moves ranks lowest score (1st place).
 * Ties are broken by lowest durationSeconds (fastest completion).
 */
export function calculateBotScore(moves: number, durationSeconds: number): number {
  const safeDuration = Math.min(Math.max(0, Math.round(durationSeconds)), 999999);
  return moves * 1_000_000 + safeDuration;
}

/**
 * Creates a unique deterministic hash for a game submission to prevent replay attacks.
 */
export function createGameSignature(
  playerId: string,
  difficulty: BotDifficulty,
  history: MoveRecord[]
): string {
  const movesSummary = history
    .map((m) => `${m.player}:${m.cell}:${m.vanished ? m.vanished.cell : '-'}`)
    .join('|');
  return crypto.createHash('sha256').update(`${playerId}:${difficulty}:${movesSummary}`).digest('hex');
}

/**
 * Server-side authoritative verification of the game history.
 * Replays every single move from turn 1 to ensure:
 * 1. Legal alternating moves under Vanish XO rules.
 * 2. Human (X) is the legitimate winner.
 * 3. Human took at least 3 moves (mathematical minimum to win 3x3).
 * 4. Realistic duration.
 */
export function verifyBotGame(
  history: MoveRecord[],
  difficulty: BotDifficulty,
  durationSeconds: number
): { valid: boolean; error?: string; humanMoves: number; totalTurns: number } {
  if (difficulty !== 'medium' && difficulty !== 'hard') {
    return { valid: false, error: 'Only Medium and Hard difficulty bot games are ranked.', humanMoves: 0, totalTurns: 0 };
  }

  if (!Array.isArray(history) || history.length < 5) {
    return { valid: false, error: 'A valid winning game requires at least 5 turns.', humanMoves: 0, totalTurns: 0 };
  }

  // Realistic human duration check (cannot win a tactical 3x3 game in less than 1.0 second)
  if (typeof durationSeconds !== 'number' || isNaN(durationSeconds) || durationSeconds < 0.8 || durationSeconds > 86400) {
    return { valid: false, error: 'Invalid or unrealistic game duration.', humanMoves: 0, totalTurns: 0 };
  }

  let currentState = createInitialState('X');

  for (let i = 0; i < history.length; i++) {
    const move = history[i];

    // Assert correct player turn
    if (move.player !== currentState.turn) {
      return {
        valid: false,
        error: `Move ${i + 1} turn mismatch: expected ${currentState.turn}, received ${move.player}`,
        humanMoves: 0,
        totalTurns: 0,
      };
    }

    // Cell must be an integer between 0 and 8
    if (typeof move.cell !== 'number' || move.cell < 0 || move.cell > 8) {
      return { valid: false, error: `Invalid cell coordinate ${move.cell} at move ${i + 1}`, humanMoves: 0, totalTurns: 0 };
    }

    // Play move using authoritative pure game engine
    const { nextState, success } = placeMark(currentState, move.cell);
    if (!success) {
      return { valid: false, error: `Illegal move at index ${i + 1} (cell ${move.cell} occupied or invalid)`, humanMoves: 0, totalTurns: 0 };
    }

    currentState = nextState;

    // If game ended before the last history move, reject premature/trailing moves
    if (currentState.winner && i < history.length - 1) {
      return { valid: false, error: 'Game terminated before all history moves were completed', humanMoves: 0, totalTurns: 0 };
    }
  }

  // Assert human (X) actually won
  if (currentState.winner !== 'X') {
    return { valid: false, error: 'Human player did not win the game.', humanMoves: 0, totalTurns: 0 };
  }

  const humanMoves = history.filter((m) => m.player === 'X').length;
  if (humanMoves < 3) {
    return { valid: false, error: 'Winning requires at least 3 moves.', humanMoves: 0, totalTurns: 0 };
  }

  return {
    valid: true,
    humanMoves,
    totalTurns: history.length,
  };
}

/**
 * Checks if a game submission is a duplicate and records it if new.
 */
export async function isDuplicateSubmission(gameSignature: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${BOT_DEDUP_KEY_PREFIX}${gameSignature}`;

  if (redis) {
    try {
      const res = await redis.set(key, '1', { nx: true, ex: 86400 * 30 }); // 30 day TTL
      return res !== 'OK';
    } catch (e) {
      console.warn('Redis error checking duplicate bot submission:', e);
    }
  }

  if (inMemoryDeduplication.has(gameSignature)) {
    return true;
  }
  inMemoryDeduplication.add(gameSignature);
  return false;
}

/**
 * Retrieves a single player's best record for a given bot difficulty.
 */
export async function getPlayerBotRecord(
  difficulty: BotDifficulty,
  playerId: string
): Promise<BotLeaderboardRecord | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const key = getBotRecordKey(difficulty, playerId);
      const data = await redis.get<BotLeaderboardRecord | string>(key);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.warn('Redis error reading player bot record:', e);
    }
  }
  const memKey = `${difficulty}:${playerId}`;
  return inMemoryBotRecords.get(memKey) || null;
}

/**
 * Records a verified bot victory and updates the player's personal best if improved.
 */
export async function recordBotVictory(input: SubmitBotGameInput): Promise<SubmitBotGameResult> {
  const { playerId, playerName, difficulty, history, durationSeconds } = input;

  if (!playerId || playerId.startsWith('p_') || playerId === 'guest') {
    throw new Error('Only authenticated users can submit leaderboard scores.');
  }

  // 1. Authoritative verification of game history
  const verification = verifyBotGame(history, difficulty, durationSeconds);
  if (!verification.valid) {
    throw new Error(verification.error || 'Invalid game history verification failed.');
  }

  // 2. Anti-replay duplicate prevention
  const signature = createGameSignature(playerId, difficulty, history);
  const isDuplicate = await isDuplicateSubmission(signature);
  if (isDuplicate) {
    throw new Error('This game result has already been submitted.');
  }

  const moves = verification.humanMoves;
  const turns = verification.totalTurns;
  const cleanDuration = Math.round(durationSeconds * 10) / 10;
  const now = Date.now();
  const displayName = playerName && playerName.trim() ? playerName.trim() : generateGuestName(playerId);

  const existingRecord = await getPlayerBotRecord(difficulty, playerId);

  // 3. Determine if this is a new personal best
  let isBetter = false;
  if (!existingRecord) {
    isBetter = true;
  } else if (moves < existingRecord.moves) {
    isBetter = true;
  } else if (moves === existingRecord.moves && cleanDuration < existingRecord.durationSeconds) {
    isBetter = true;
  }

  const recordToSave: BotLeaderboardRecord = isBetter
    ? {
        playerId,
        playerName: displayName,
        difficulty,
        moves,
        turns,
        durationSeconds: cleanDuration,
        completedAt: now,
      }
    : existingRecord!;

  // 4. Update Redis or in-memory store
  const redis = getRedis();
  const leaderboardKey = getBotLeaderboardKey(difficulty);
  const recordKey = getBotRecordKey(difficulty, playerId);

  if (isBetter) {
    const score = calculateBotScore(moves, cleanDuration);

    if (redis) {
      try {
        await Promise.all([
          redis.zadd(leaderboardKey, { score, member: playerId }),
          redis.set(recordKey, JSON.stringify(recordToSave)),
        ]);
      } catch (e) {
        console.warn('Redis error saving bot record, falling back to memory:', e);
        inMemoryBotRecords.set(`${difficulty}:${playerId}`, recordToSave);
      }
    } else {
      inMemoryBotRecords.set(`${difficulty}:${playerId}`, recordToSave);
    }
  }

  // 5. Calculate player rank
  let rank: number | undefined;
  if (redis) {
    try {
      const zrank = await redis.zrank(leaderboardKey, playerId);
      if (zrank !== null && zrank !== undefined) {
        rank = zrank + 1;
      }
    } catch {
      // Fall through
    }
  }

  if (rank === undefined) {
    const all = Array.from(inMemoryBotRecords.values())
      .filter((r) => r.difficulty === difficulty)
      .sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.durationSeconds - b.durationSeconds;
      });
    const idx = all.findIndex((r) => r.playerId === playerId);
    if (idx !== -1) rank = idx + 1;
  }

  return {
    success: true,
    isNewRecord: !existingRecord,
    isImprovement: isBetter,
    record: recordToSave,
    rank,
    message: isBetter
      ? existingRecord
        ? `New personal best! Defeated ${difficulty} bot in ${moves} moves (${cleanDuration}s)!`
        : `First record! Defeated ${difficulty} bot in ${moves} moves (${cleanDuration}s)!`
      : existingRecord
      ? `Win recorded, but your previous record of ${existingRecord.moves} moves (${existingRecord.durationSeconds}s) remains your best.`
      : 'Win recorded.',
  };
}

/**
 * Retrieves the Fewest Moves to Beat the Bot Leaderboard for a given difficulty.
 */
export async function getBotLeaderboard(
  difficulty: BotDifficulty,
  limit = 50
): Promise<BotLeaderboardEntry[]> {
  const redis = getRedis();
  const leaderboardKey = getBotLeaderboardKey(difficulty);

  if (redis) {
    try {
      // ZRANGE ascending (lowest score = fewest moves = rank 1)
      const results = await redis.zrange<(string | number)[]>(
        leaderboardKey,
        0,
        limit - 1,
        { withScores: true }
      );

      if (!results || results.length === 0) {
        return [];
      }

      const entries: BotLeaderboardEntry[] = [];
      const isObjectArray = typeof results[0] === 'object' && results[0] !== null && 'member' in results[0];

      if (isObjectArray) {
        for (let i = 0; i < results.length; i++) {
          const item = results[i] as unknown as { member: string; score: number };
          const pId = item.member;
          const record = await getPlayerBotRecord(difficulty, pId);
          if (record) {
            entries.push({
              ...record,
              rank: i + 1,
            });
          }
        }
      } else {
        // Paired array format [member, score, member, score, ...]
        for (let i = 0; i < results.length; i += 2) {
          const pId = String(results[i]);
          const record = await getPlayerBotRecord(difficulty, pId);
          if (record) {
            entries.push({
              ...record,
              rank: Math.floor(i / 2) + 1,
            });
          }
        }
      }

      return entries;
    } catch (e) {
      console.warn('Redis error in getBotLeaderboard, falling back to memory:', e);
    }
  }

  // In-memory fallback
  const matching = Array.from(inMemoryBotRecords.values())
    .filter((r) => r.difficulty === difficulty)
    .sort((a, b) => {
      if (a.moves !== b.moves) return a.moves - b.moves;
      return a.durationSeconds - b.durationSeconds;
    })
    .slice(0, limit);

  return matching.map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));
}

/**
 * Resets bot leaderboard records (used by admin scripts and unit tests).
 */
export async function resetBotLeaderboard(
  difficulty?: BotDifficulty
): Promise<{ success: boolean; clearedCount: number }> {
  let clearedCount = 0;
  const difficulties: BotDifficulty[] = difficulty ? [difficulty] : ['medium', 'hard'];

  for (const diff of difficulties) {
    for (const [key] of inMemoryBotRecords.entries()) {
      if (key.startsWith(`${diff}:`)) {
        inMemoryBotRecords.delete(key);
        clearedCount++;
      }
    }
  }
  inMemoryDeduplication.clear();

  const redis = getRedis();
  if (redis) {
    try {
      for (const diff of difficulties) {
        await redis.del(getBotLeaderboardKey(diff));
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, {
            match: `vanish_xo:bot_record:${diff}:*`,
            count: 100,
          });
          cursor = nextCursor;
          if (keys && keys.length > 0) {
            await redis.del(...keys);
            clearedCount += keys.length;
          }
        } while (cursor !== '0');
      }
    } catch (e) {
      console.warn('Redis error clearing bot leaderboard:', e);
    }
  }

  return { success: true, clearedCount };
}

