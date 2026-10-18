import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInitialProgression,
  getRank,
  getBadges,
  updateStats,
  checkNoVanishLoss,
  loadProgression,
  saveProgression,
  PROGRESSION_STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
} from './progress';
import { MoveRecord } from './types';
import { getConfigForPlayers } from './game';

// In-memory localStorage mock for Vitest in node environment
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;

describe('Vanish XO - Local Progression System', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Rank Tiers & Point Changes', () => {
    it('initializes at Bronze with 0 points', () => {
      const rank = getRank(0);
      expect(rank.tier).toBe('BRONZE');
      expect(rank.points).toBe(0);
      expect(rank.nextTier).toBe('SILVER');
      expect(rank.pointsToNext).toBe(10);
      expect(rank.progressPercent).toBe(0);
    });

    it('awards correct points for bot wins', () => {
      const data = createInitialProgression();

      // Easy bot win: +1
      const resEasy = updateStats(data, {
        mode: '2P',
        opponent: 'Easy',
        won: true,
        turns: 7,
      });
      expect(resEasy.rankDelta).toBe(1);
      expect(resEasy.nextData.rankPoints).toBe(1);

      // Medium bot win: +3
      const resMed = updateStats(resEasy.nextData, {
        mode: '2P',
        opponent: 'Medium',
        won: true,
        turns: 7,
      });
      expect(resMed.rankDelta).toBe(3);
      expect(resMed.nextData.rankPoints).toBe(4);

      // Hard bot win: +6
      const resHard = updateStats(resMed.nextData, {
        mode: '2P',
        opponent: 'Hard',
        won: true,
        turns: 7,
      });
      expect(resHard.rankDelta).toBe(6);
      expect(resHard.nextData.rankPoints).toBe(10);
    });

    it('deducts correct points for bot losses and never drops below 0', () => {
      const data = createInitialProgression();
      data.rankPoints = 3;

      // Loss to Easy: -2
      const res1 = updateStats(data, {
        mode: '2P',
        opponent: 'Easy',
        won: false,
        turns: 6,
      });
      expect(res1.rankDelta).toBe(-2);
      expect(res1.nextData.rankPoints).toBe(1);

      // Loss to Medium: -1
      const res2 = updateStats(res1.nextData, {
        mode: '2P',
        opponent: 'Medium',
        won: false,
        turns: 6,
      });
      expect(res2.rankDelta).toBe(-1);
      expect(res2.nextData.rankPoints).toBe(0);

      // Loss to Easy at 0 points: clamps to 0
      const res3 = updateStats(res2.nextData, {
        mode: '2P',
        opponent: 'Easy',
        won: false,
        turns: 6,
      });
      expect(res3.rankDelta).toBe(0);
      expect(res3.nextData.rankPoints).toBe(0);

      // Loss to Hard: 0 deduction
      data.rankPoints = 5;
      const res4 = updateStats(data, {
        mode: '2P',
        opponent: 'Hard',
        won: false,
        turns: 6,
      });
      expect(res4.rankDelta).toBe(0);
      expect(res4.nextData.rankPoints).toBe(5);
    });

    it('does not alter bot ladder points for human games', () => {
      const data = createInitialProgression();
      data.rankPoints = 15;

      const winHuman = updateStats(data, {
        mode: '2P',
        opponent: 'human',
        won: true,
        turns: 7,
      });
      expect(winHuman.rankDelta).toBe(0);
      expect(winHuman.nextData.rankPoints).toBe(15);

      const lossHuman = updateStats(data, {
        mode: '2P',
        opponent: 'human',
        won: false,
        turns: 7,
      });
      expect(lossHuman.rankDelta).toBe(0);
      expect(lossHuman.nextData.rankPoints).toBe(15);
    });

    it('calculates tier boundaries accurately and detects rank-up', () => {
      // Thresholds: Bronze 0, Silver 10, Gold 25, Platinum 50, Diamond 85
      expect(getRank(0).tier).toBe('BRONZE');
      expect(getRank(9).tier).toBe('BRONZE');
      expect(getRank(10).tier).toBe('SILVER');
      expect(getRank(24).tier).toBe('SILVER');
      expect(getRank(25).tier).toBe('GOLD');
      expect(getRank(49).tier).toBe('GOLD');
      expect(getRank(50).tier).toBe('PLATINUM');
      expect(getRank(84).tier).toBe('PLATINUM');
      expect(getRank(85).tier).toBe('DIAMOND');
      expect(getRank(100).tier).toBe('DIAMOND');
      expect(getRank(100).nextTier).toBeNull();
      expect(getRank(100).progressPercent).toBe(100);

      // Check rank up detection from updateStats
      const data = createInitialProgression();
      data.rankPoints = 9;

      const resRankUp = updateStats(data, {
        mode: '2P',
        opponent: 'Medium',
        won: true,
        turns: 7,
      });
      expect(resRankUp.nextData.rankPoints).toBe(12);
      expect(resRankUp.rankUpTier).toBe('SILVER');

      // Another win within same tier does not trigger rankUpTier
      const resStay = updateStats(resRankUp.nextData, {
        mode: '2P',
        opponent: 'Easy',
        won: true,
        turns: 7,
      });
      expect(resStay.rankUpTier).toBeNull();
    });
  });

  describe('Streak Tracking & Resets', () => {
    it('increments streak on consecutive wins and resets on loss', () => {
      const data = createInitialProgression();

      // Win 1
      const res1 = updateStats(data, { mode: '2P', opponent: 'Easy', won: true, turns: 6 });
      expect(res1.nextData.overall.currentStreak).toBe(1);
      expect(res1.nextData.overall.bestStreak).toBe(1);
      expect(res1.nextData.stats['2P'].Easy.currentStreak).toBe(1);

      // Win 2
      const res2 = updateStats(res1.nextData, { mode: '2P', opponent: 'Easy', won: true, turns: 6 });
      expect(res2.nextData.overall.currentStreak).toBe(2);
      expect(res2.nextData.overall.bestStreak).toBe(2);
      expect(res2.nextData.stats['2P'].Easy.currentStreak).toBe(2);

      // Win 3 (different mode slice)
      const res3 = updateStats(res2.nextData, { mode: '3P', opponent: 'human', won: true, turns: 9 });
      expect(res3.nextData.overall.currentStreak).toBe(3);
      expect(res3.nextData.overall.bestStreak).toBe(3);
      expect(res3.nextData.stats['3P'].human.currentStreak).toBe(1);
      expect(res3.nextData.stats['2P'].Easy.currentStreak).toBe(2);

      // Loss resets overall and slice streak
      const resLoss = updateStats(res3.nextData, { mode: '2P', opponent: 'Easy', won: false, turns: 6 });
      expect(resLoss.nextData.overall.currentStreak).toBe(0);
      expect(resLoss.nextData.overall.bestStreak).toBe(3); // retains best streak
      expect(resLoss.nextData.stats['2P'].Easy.currentStreak).toBe(0);
      expect(resLoss.nextData.stats['2P'].Easy.bestStreak).toBe(2);
    });

    it('tracks fastest win correctly', () => {
      const data = createInitialProgression();

      const res1 = updateStats(data, { mode: '2P', opponent: 'Medium', won: true, turns: 9 });
      expect(res1.nextData.overall.fastestWin).toBe(9);
      expect(res1.nextData.stats['2P'].Medium.fastestWin).toBe(9);

      // Slower win does not replace fastestWin
      const res2 = updateStats(res1.nextData, { mode: '2P', opponent: 'Medium', won: true, turns: 11 });
      expect(res2.nextData.overall.fastestWin).toBe(9);
      expect(res2.nextData.stats['2P'].Medium.fastestWin).toBe(9);

      // Faster win updates fastestWin
      const res3 = updateStats(res2.nextData, { mode: '2P', opponent: 'Medium', won: true, turns: 7 });
      expect(res3.nextData.overall.fastestWin).toBe(7);
      expect(res3.nextData.stats['2P'].Medium.fastestWin).toBe(7);
    });
  });

  describe('Badges System', () => {
    it('unlocks first_win and bot ladder badges', () => {
      const data = createInitialProgression();

      const resEasy = updateStats(data, { mode: '2P', opponent: 'Easy', won: true, turns: 10 });
      expect(resEasy.newBadges).toContain('first_win');
      expect(resEasy.newBadges).toContain('beat_easy');

      const resMed = updateStats(resEasy.nextData, { mode: '2P', opponent: 'Medium', won: true, turns: 10 });
      expect(resMed.newBadges).toContain('beat_medium');
      expect(resMed.newBadges).not.toContain('first_win'); // already unlocked

      const resHard = updateStats(resMed.nextData, { mode: '2P', opponent: 'Hard', won: true, turns: 10 });
      expect(resHard.newBadges).toContain('beat_hard');
    });

    it('unlocks streak badges (3 and 5 streak)', () => {
      let data = createInitialProgression();

      for (let i = 1; i <= 2; i++) {
        data = updateStats(data, { mode: '2P', opponent: 'Easy', won: true, turns: 10 }).nextData;
      }
      expect(data.badges.streak_3).toBeUndefined();

      // 3rd win unlocks streak_3
      const res3 = updateStats(data, { mode: '2P', opponent: 'Easy', won: true, turns: 10 });
      expect(res3.newBadges).toContain('streak_3');

      // 4th win
      data = updateStats(res3.nextData, { mode: '2P', opponent: 'Easy', won: true, turns: 10 }).nextData;
      expect(data.badges.streak_5).toBeUndefined();

      // 5th win unlocks streak_5
      const res5 = updateStats(data, { mode: '2P', opponent: 'Easy', won: true, turns: 10 });
      expect(res5.newBadges).toContain('streak_5');
    });

    it('unlocks speed_win for win in 8 moves or fewer', () => {
      const data = createInitialProgression();

      const slowWin = updateStats(data, { mode: '2P', opponent: 'human', won: true, turns: 9 });
      expect(slowWin.newBadges).not.toContain('speed_win');

      const speedWin = updateStats(data, { mode: '2P', opponent: 'human', won: true, turns: 8 });
      expect(speedWin.newBadges).toContain('speed_win');
    });

    it('unlocks win_3p and win_4p badges', () => {
      const data = createInitialProgression();

      const res3p = updateStats(data, { mode: '3P', opponent: 'human', won: true, turns: 12 });
      expect(res3p.newBadges).toContain('win_3p');

      const res4p = updateStats(res3p.nextData, { mode: '4P', opponent: 'human', won: true, turns: 15 });
      expect(res4p.newBadges).toContain('win_4p');
    });

    it('unlocks flawless_hard when beating Hard with no vanish loss', () => {
      const data = createInitialProgression();

      // Flawless hard win (flawlessVanish true)
      const resFlawless = updateStats(data, {
        mode: '2P',
        opponent: 'Hard',
        won: true,
        turns: 7,
        flawlessVanish: true,
      });
      expect(resFlawless.newBadges).toContain('beat_hard');
      expect(resFlawless.newBadges).toContain('flawless_hard');

      // Non-flawless hard win (flawlessVanish false)
      const resBlunder = updateStats(data, {
        mode: '2P',
        opponent: 'Hard',
        won: true,
        turns: 12,
        flawlessVanish: false,
      });
      expect(resBlunder.newBadges).toContain('beat_hard');
      expect(resBlunder.newBadges).not.toContain('flawless_hard');
    });

    it('checkNoVanishLoss evaluates move history correctly', () => {
      const config = getConfigForPlayers(2);

      // 1. History where player X wins in 5 turns (no vanish ever happened)
      const quickHistory: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 2, vanished: null },
      ];
      expect(checkNoVanishLoss(quickHistory, 'X', config)).toBe(true);

      // 2. History where X had a vanish on turn 7 and it gave opponent an immediate winning line (missed block)
      const blunderHistory: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 6, vanished: null },
        { player: 'O', cell: 8, vanished: null }, // O has 3, 4, 8. Winning reply for O is 5 (row 3,4,5).
        // On turn 7, X places at 7. X's mark at 0 vanishes.
        // O now has an immediate win available at cell 5!
        { player: 'X', cell: 7, vanished: { symbol: 'X', cell: 0 } },
      ];
      expect(checkNoVanishLoss(blunderHistory, 'X', config)).toBe(false);
    });

    it('getBadges returns complete list with unlocked statuses', () => {
      const data = createInitialProgression();
      data.badges.first_win = 123456789;

      const badges = getBadges(data);
      expect(badges.length).toBe(10);

      const firstWin = badges.find((b) => b.id === 'first_win');
      expect(firstWin?.isUnlocked).toBe(true);
      expect(firstWin?.unlockedAt).toBe(123456789);

      const hardBot = badges.find((b) => b.id === 'beat_hard');
      expect(hardBot?.isUnlocked).toBe(false);
      expect(hardBot?.unlockedAt).toBeNull();
    });
  });

  describe('localStorage Robustness & Schema Versioning', () => {
    it('returns default progression when localStorage is empty', () => {
      const loaded = loadProgression();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.rankPoints).toBe(0);
      expect(loaded.overall.gamesPlayed).toBe(0);
      expect(loaded.overall.currentStreak).toBe(0);
    });

    it('handles corrupted JSON without crashing', () => {
      mockStorage.setItem(PROGRESSION_STORAGE_KEY, '{ invalid JSON :;;');
      const loaded = loadProgression();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.rankPoints).toBe(0);
    });

    it('handles incompatible schema versions by returning clean defaults', () => {
      mockStorage.setItem(
        PROGRESSION_STORAGE_KEY,
        JSON.stringify({ version: 999, rankPoints: 500 })
      );
      const loaded = loadProgression();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.rankPoints).toBe(0);
    });

    it('saves and loads valid progression data correctly', () => {
      let data = createInitialProgression();
      data = updateStats(data, { mode: '2P', opponent: 'Hard', won: true, turns: 7 }).nextData;

      const saved = saveProgression(data);
      expect(saved).toBe(true);

      const loaded = loadProgression();
      expect(loaded.rankPoints).toBe(6);
      expect(loaded.overall.wins).toBe(1);
      expect(loaded.stats['2P'].Hard.wins).toBe(1);
      expect(loaded.badges.first_win).toBeDefined();
      expect(loaded.badges.beat_hard).toBeDefined();
    });

    it('safely tolerates localStorage throwing errors (e.g. quota exceeded / disabled)', () => {
      const getItemSpy = vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied for this document');
      });
      const loaded = loadProgression();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.rankPoints).toBe(0);
      getItemSpy.mockRestore();

      const setItemSpy = vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const saveResult = saveProgression(loaded);
      expect(saveResult).toBe(false);
      setItemSpy.mockRestore();
    });
  });
});
