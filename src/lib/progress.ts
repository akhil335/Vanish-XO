import { GameConfig, MarkSymbol, MoveRecord } from './types';
import { getConfigForPlayers, getMoveInsights } from './game';

export type GameMode = '2P' | '3P' | '4P';
export type OpponentType = 'Easy' | 'Medium' | 'Hard' | 'human';

export const GAME_MODES: readonly GameMode[] = ['2P', '3P', '4P'] as const;
export const OPPONENT_TYPES: readonly OpponentType[] = ['Easy', 'Medium', 'Hard', 'human'] as const;

export interface SliceStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  fastestWin: number | null; // in turns/moves
}

export interface OverallStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  fastestWin: number | null;
}

export type StatsMatrix = Record<GameMode, Record<OpponentType, SliceStats>>;

export type RankTierKey = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export const TIER_ORDER: readonly RankTierKey[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
] as const;

export interface RankTierDefinition {
  key: RankTierKey;
  name: string; // 1-2 words
  minPoints: number;
  color: string;
  glow: string;
  textColor: string;
}

/**
 * Tunable rank thresholds and definitions in one unified configuration object.
 */
export const RANK_CONFIG: {
  points: {
    WIN: Record<OpponentType, number>;
    LOSS: Record<OpponentType, number>;
  };
  tiers: Record<RankTierKey, RankTierDefinition>;
} = {
  points: {
    WIN: {
      Easy: 1,
      Medium: 3,
      Hard: 6,
      human: 0,
    },
    LOSS: {
      Easy: -2,
      Medium: -1,
      Hard: 0,
      human: 0,
    },
  },
  tiers: {
    BRONZE: {
      key: 'BRONZE',
      name: 'Bronze',
      minPoints: 0,
      color: '#cd7f32',
      glow: 'rgba(205, 127, 50, 0.45)',
      textColor: 'text-amber-600',
    },
    SILVER: {
      key: 'SILVER',
      name: 'Silver',
      minPoints: 10,
      color: '#cbd5e1',
      glow: 'rgba(203, 213, 225, 0.45)',
      textColor: 'text-slate-300',
    },
    GOLD: {
      key: 'GOLD',
      name: 'Gold',
      minPoints: 25,
      color: '#eab308',
      glow: 'rgba(234, 179, 8, 0.45)',
      textColor: 'text-yellow-400',
    },
    PLATINUM: {
      key: 'PLATINUM',
      name: 'Platinum',
      minPoints: 50,
      color: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.45)',
      textColor: 'text-cyan-400',
    },
    DIAMOND: {
      key: 'DIAMOND',
      name: 'Diamond',
      minPoints: 85,
      color: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.45)',
      textColor: 'text-purple-400',
    },
  },
};

export interface BadgeDefinition {
  id: string;
  name: string; // 1-2 words
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'first_win',
    name: 'First Win',
    description: 'Win your first game',
    icon: 'trophy',
  },
  {
    id: 'beat_easy',
    name: 'Easy Bot',
    description: 'Beat Easy bot (2P)',
    icon: 'bot-easy',
  },
  {
    id: 'beat_medium',
    name: 'Med Bot',
    description: 'Beat Medium bot (2P)',
    icon: 'bot-med',
  },
  {
    id: 'beat_hard',
    name: 'Hard Bot',
    description: 'Beat Hard bot (2P)',
    icon: 'bot-hard',
  },
  {
    id: 'streak_3',
    name: '3 Streak',
    description: 'Win 3 in a row',
    icon: 'flame-3',
  },
  {
    id: 'streak_5',
    name: '5 Streak',
    description: 'Win 5 in a row',
    icon: 'flame-5',
  },
  {
    id: 'speed_win',
    name: 'Speed Win',
    description: 'Win in 8 moves or fewer',
    icon: 'zap',
  },
  {
    id: 'win_3p',
    name: '3P Win',
    description: 'Win a 3-player game',
    icon: 'users-3',
  },
  {
    id: 'win_4p',
    name: '4P Win',
    description: 'Win a 4-player game',
    icon: 'users-4',
  },
  {
    id: 'flawless_hard',
    name: 'Flawless',
    description: 'Beat Hard with no vanish loss',
    icon: 'shield-check',
  },
] as const;

export interface BadgeStatus extends BadgeDefinition {
  isUnlocked: boolean;
  unlockedAt: number | null;
}

export interface ProgressionData {
  version: number;
  rankPoints: number;
  stats: StatsMatrix;
  overall: OverallStats;
  badges: Record<string, number>; // badgeId -> timestamp
}

export interface GameResultContext {
  mode: GameMode;
  opponent: OpponentType;
  won: boolean;
  turns: number; // total moves or turns
  history?: MoveRecord[];
  playerSymbol?: MarkSymbol;
  config?: GameConfig;
  flawlessVanish?: boolean;
}

export interface RankInfo extends RankTierDefinition {
  tier: RankTierKey;
  points: number;
  nextTier: RankTierKey | null;
  nextTierMinPoints: number | null;
  pointsToNext: number | null;
  progressPercent: number; // 0 to 100
}

export interface UpdateStatsResult {
  nextData: ProgressionData;
  rankDelta: number;
  newBadges: string[];
  rankUpTier: RankTierKey | null;
  newStreakReached: number | null;
}

export const CURRENT_SCHEMA_VERSION = 1;
export const PROGRESSION_STORAGE_KEY = 'vanish_xo_progression_v1';

/**
 * Creates empty slice statistics.
 */
export function createEmptySliceStats(): SliceStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    fastestWin: null,
  };
}

/**
 * Creates empty stats matrix across all modes and opponent types.
 */
export function createEmptyStatsMatrix(): StatsMatrix {
  const matrix = {} as StatsMatrix;
  for (const mode of GAME_MODES) {
    matrix[mode] = {
      Easy: createEmptySliceStats(),
      Medium: createEmptySliceStats(),
      Hard: createEmptySliceStats(),
      human: createEmptySliceStats(),
    };
  }
  return matrix;
}

/**
 * Creates a pristine, initial progression object.
 */
export function createInitialProgression(): ProgressionData {
  return {
    version: CURRENT_SCHEMA_VERSION,
    rankPoints: 0,
    stats: createEmptyStatsMatrix(),
    overall: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      fastestWin: null,
    },
    badges: {},
  };
}

/**
 * Pure function: calculates rank details from points.
 */
export function getRank(points: number): RankInfo {
  const safePoints = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  let currentTierKey: RankTierKey = 'BRONZE';

  for (const key of TIER_ORDER) {
    if (safePoints >= RANK_CONFIG.tiers[key].minPoints) {
      currentTierKey = key;
    }
  }

  const currentTier = RANK_CONFIG.tiers[currentTierKey];
  const currentIndex = TIER_ORDER.indexOf(currentTierKey);
  const nextTierKey = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;

  let nextTierMinPoints: number | null = null;
  let pointsToNext: number | null = null;
  let progressPercent = 100;

  if (nextTierKey) {
    const nextTier = RANK_CONFIG.tiers[nextTierKey];
    nextTierMinPoints = nextTier.minPoints;
    pointsToNext = Math.max(0, nextTierMinPoints - safePoints);
    const range = nextTierMinPoints - currentTier.minPoints;
    const progressInRange = safePoints - currentTier.minPoints;
    progressPercent = range > 0 ? Math.min(100, Math.max(0, Math.round((progressInRange / range) * 100))) : 100;
  }

  return {
    ...currentTier,
    tier: currentTierKey,
    points: safePoints,
    nextTier: nextTierKey,
    nextTierMinPoints,
    pointsToNext,
    progressPercent,
  };
}

/**
 * Pure function: returns all badge statuses (unlocked vs locked outlines).
 */
export function getBadges(data: ProgressionData): BadgeStatus[] {
  const badges = data?.badges || {};
  return BADGE_DEFINITIONS.map((def) => ({
    ...def,
    isUnlocked: typeof badges[def.id] === 'number',
    unlockedAt: typeof badges[def.id] === 'number' ? badges[def.id] : null,
  }));
}

/**
 * Pure function: verifies if player never had their oldest mark removed on a move that helped the opponent.
 */
export function checkNoVanishLoss(
  history?: MoveRecord[],
  player: MarkSymbol = 'X',
  config: GameConfig = getConfigForPlayers(2)
): boolean {
  if (!history || history.length === 0) return true;
  const insights = getMoveInsights(history, config);

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    if (move.player === player && move.vanished) {
      // Oldest mark was removed before placement on this move
      if (insights[i]?.hasWarning) {
        // This move gave opponent an immediate winning reply
        return false;
      }
    }
  }

  return true;
}

/**
 * Pure helper: normalizes opponent type string if necessary.
 */
export function normalizeOpponentType(raw: string): OpponentType {
  const lower = raw?.toLowerCase();
  if (lower === 'easy') return 'Easy';
  if (lower === 'medium') return 'Medium';
  if (lower === 'hard') return 'Hard';
  return 'human';
}

/**
 * Pure function: updates stats, bot ladder points, and unlocks badges.
 */
export function updateStats(
  prevData: ProgressionData,
  result: GameResultContext
): UpdateStatsResult {
  const current = prevData && prevData.version === CURRENT_SCHEMA_VERSION
    ? prevData
    : createInitialProgression();

  // Deep clone state
  const nextData: ProgressionData = {
    version: CURRENT_SCHEMA_VERSION,
    rankPoints: current.rankPoints,
    stats: {
      '2P': {
        Easy: { ...current.stats['2P'].Easy },
        Medium: { ...current.stats['2P'].Medium },
        Hard: { ...current.stats['2P'].Hard },
        human: { ...current.stats['2P'].human },
      },
      '3P': {
        Easy: { ...current.stats['3P'].Easy },
        Medium: { ...current.stats['3P'].Medium },
        Hard: { ...current.stats['3P'].Hard },
        human: { ...current.stats['3P'].human },
      },
      '4P': {
        Easy: { ...current.stats['4P'].Easy },
        Medium: { ...current.stats['4P'].Medium },
        Hard: { ...current.stats['4P'].Hard },
        human: { ...current.stats['4P'].human },
      },
    },
    overall: { ...current.overall },
    badges: { ...current.badges },
  };

  const mode = result.mode;
  const opp = result.opponent;
  const targetSlice = nextData.stats[mode][opp];

  // Update Slice Stats
  targetSlice.gamesPlayed += 1;
  if (result.won) {
    targetSlice.wins += 1;
    targetSlice.currentStreak += 1;
    targetSlice.bestStreak = Math.max(targetSlice.bestStreak, targetSlice.currentStreak);
    targetSlice.fastestWin = targetSlice.fastestWin === null
      ? result.turns
      : Math.min(targetSlice.fastestWin, result.turns);
  } else {
    targetSlice.losses += 1;
    targetSlice.currentStreak = 0;
  }

  // Update Overall Stats
  nextData.overall.gamesPlayed += 1;
  let newStreakReached: number | null = null;

  if (result.won) {
    nextData.overall.wins += 1;
    nextData.overall.currentStreak += 1;
    nextData.overall.bestStreak = Math.max(nextData.overall.bestStreak, nextData.overall.currentStreak);
    nextData.overall.fastestWin = nextData.overall.fastestWin === null
      ? result.turns
      : Math.min(nextData.overall.fastestWin, result.turns);

    newStreakReached = nextData.overall.currentStreak;
  } else {
    nextData.overall.losses += 1;
    nextData.overall.currentStreak = 0;
  }

  // Rank points: Bot ladder only (human games don't alter bot ladder points)
  let rawChange = 0;
  if (result.won) {
    rawChange = RANK_CONFIG.points.WIN[opp] ?? 0;
  } else {
    rawChange = RANK_CONFIG.points.LOSS[opp] ?? 0;
  }

  const oldPoints = current.rankPoints;
  const newPoints = Math.max(0, oldPoints + rawChange);
  const rankDelta = newPoints - oldPoints;
  nextData.rankPoints = newPoints;

  // Rank Up Check
  const oldTier = getRank(oldPoints).tier;
  const newTier = getRank(newPoints).tier;
  let rankUpTier: RankTierKey | null = null;
  if (TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
    rankUpTier = newTier;
  }

  // Badges Check
  const newBadges: string[] = [];
  const now = Date.now();

  const unlockBadge = (badgeId: string) => {
    if (!nextData.badges[badgeId]) {
      nextData.badges[badgeId] = now;
      newBadges.push(badgeId);
    }
  };

  // Badge 1: First win
  if (result.won) {
    unlockBadge('first_win');
  }

  // Badge 2: Beat Easy Bot (2P)
  if (result.won && mode === '2P' && opp === 'Easy') {
    unlockBadge('beat_easy');
  }

  // Badge 3: Beat Medium Bot (2P)
  if (result.won && mode === '2P' && opp === 'Medium') {
    unlockBadge('beat_medium');
  }

  // Badge 4: Beat Hard Bot (2P)
  if (result.won && mode === '2P' && opp === 'Hard') {
    unlockBadge('beat_hard');
  }

  // Badge 5: 3-win streak
  if (nextData.overall.currentStreak >= 3) {
    unlockBadge('streak_3');
  }

  // Badge 6: 5-win streak
  if (nextData.overall.currentStreak >= 5) {
    unlockBadge('streak_5');
  }

  // Badge 7: Speed win in 8 moves or fewer
  if (result.won && result.turns <= 8) {
    unlockBadge('speed_win');
  }

  // Badge 8: Win 3P game
  if (result.won && mode === '3P') {
    unlockBadge('win_3p');
  }

  // Badge 9: Win 4P game
  if (result.won && mode === '4P') {
    unlockBadge('win_4p');
  }

  // Badge 10: Beat Hard with no vanish loss
  if (result.won && mode === '2P' && opp === 'Hard') {
    const isFlawless = typeof result.flawlessVanish === 'boolean'
      ? result.flawlessVanish
      : checkNoVanishLoss(result.history, result.playerSymbol || 'X', result.config || getConfigForPlayers(2));
    if (isFlawless) {
      unlockBadge('flawless_hard');
    }
  }

  return {
    nextData,
    rankDelta,
    newBadges,
    rankUpTier,
    newStreakReached,
  };
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Safe localStorage loader with version check and try/catch.
 * If data is corrupted, missing, or throws, safely returns default initial data.
 */
export function loadProgression(): ProgressionData {
  try {
    const storage = getStorage();
    if (!storage) {
      return createInitialProgression();
    }

    const raw = storage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) {
      return createInitialProgression();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CURRENT_SCHEMA_VERSION) {
      return createInitialProgression();
    }

    // Deep merge stats safely
    const stats = createEmptyStatsMatrix();
    for (const m of GAME_MODES) {
      for (const o of OPPONENT_TYPES) {
        if (parsed.stats?.[m]?.[o]) {
          stats[m][o] = {
            gamesPlayed: Number(parsed.stats[m][o].gamesPlayed) || 0,
            wins: Number(parsed.stats[m][o].wins) || 0,
            losses: Number(parsed.stats[m][o].losses) || 0,
            currentStreak: Number(parsed.stats[m][o].currentStreak) || 0,
            bestStreak: Number(parsed.stats[m][o].bestStreak) || 0,
            fastestWin: parsed.stats[m][o].fastestWin !== null && Number.isFinite(parsed.stats[m][o].fastestWin)
              ? Number(parsed.stats[m][o].fastestWin)
              : null,
          };
        }
      }
    }

    const overall: OverallStats = {
      gamesPlayed: Number(parsed.overall?.gamesPlayed) || 0,
      wins: Number(parsed.overall?.wins) || 0,
      losses: Number(parsed.overall?.losses) || 0,
      currentStreak: Number(parsed.overall?.currentStreak) || 0,
      bestStreak: Number(parsed.overall?.bestStreak) || 0,
      fastestWin: parsed.overall?.fastestWin !== null && Number.isFinite(parsed.overall?.fastestWin)
        ? Number(parsed.overall?.fastestWin)
        : null,
    };

    const badges: Record<string, number> = {};
    if (parsed.badges && typeof parsed.badges === 'object') {
      for (const [k, v] of Object.entries(parsed.badges)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          badges[k] = v;
        }
      }
    }

    const rankPoints = Math.max(0, Number(parsed.rankPoints) || 0);

    return {
      version: CURRENT_SCHEMA_VERSION,
      rankPoints,
      stats,
      overall,
      badges,
    };
  } catch {
    return createInitialProgression();
  }
}

/**
 * Safe localStorage saver with try/catch.
 */
export function saveProgression(data: ProgressionData): boolean {
  try {
    const storage = getStorage();
    if (!storage) {
      return false;
    }

    storage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
