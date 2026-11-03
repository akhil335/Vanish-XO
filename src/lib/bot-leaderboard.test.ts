import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBotScore,
  verifyBotGame,
  recordBotVictory,
  getBotLeaderboard,
  resetBotLeaderboard,
  getPlayerBotRecord,
  BotDifficulty,
} from './bot-leaderboard';
import { MoveRecord } from './types';

describe('Fewest Moves to Beat the Bot Leaderboard', () => {
  beforeEach(async () => {
    await resetBotLeaderboard();
  });

  describe('Score Calculation & Ranking Formula', () => {
    it('ranks fewer moves higher than more moves regardless of duration', () => {
      const score3MovesSlow = calculateBotScore(3, 45); // 3 moves in 45s
      const score4MovesFast = calculateBotScore(4, 5);  // 4 moves in 5s
      expect(score3MovesSlow).toBeLessThan(score4MovesFast);
    });

    it('breaks ties in moves using completion duration in seconds', () => {
      const score4MovesFast = calculateBotScore(4, 12);
      const score4MovesSlow = calculateBotScore(4, 18);
      expect(score4MovesFast).toBeLessThan(score4MovesSlow);
    });
  });

  describe('Server Replay & Anti-Manipulation Verification', () => {
    // 5-turn classic win for X:
    // Turn 1: X at 0
    // Turn 2: O at 3
    // Turn 3: X at 1
    // Turn 4: O at 4
    // Turn 5: X at 2 -> Winning line [0, 1, 2]
    const validWinningHistory: MoveRecord[] = [
      { player: 'X', cell: 0, vanished: null },
      { player: 'O', cell: 3, vanished: null },
      { player: 'X', cell: 1, vanished: null },
      { player: 'O', cell: 4, vanished: null },
      { player: 'X', cell: 2, vanished: null },
    ];

    it('successfully verifies a legitimate 3-move human win', () => {
      const result = verifyBotGame(validWinningHistory, 'medium', 12.5);
      expect(result.valid).toBe(true);
      expect(result.humanMoves).toBe(3);
      expect(result.totalTurns).toBe(5);
    });

    it('rejects games for unranked difficulty (e.g. easy)', () => {
      const result = verifyBotGame(validWinningHistory, 'easy' as BotDifficulty, 12.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only Medium and Hard');
    });

    it('rejects games with impossible duration (< 0.8s)', () => {
      const result = verifyBotGame(validWinningHistory, 'hard', 0.2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unrealistic game duration');
    });

    it('rejects games where human did not win', () => {
      // History where O wins:
      // Turn 1: X at 0
      // Turn 2: O at 3
      // Turn 3: X at 1
      // Turn 4: O at 4
      // Turn 5: X at 8
      // Turn 6: O at 5 -> O wins line [3, 4, 5]
      const oWinsHistory: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 8, vanished: null },
        { player: 'O', cell: 5, vanished: null },
      ];
      const result = verifyBotGame(oWinsHistory, 'hard', 15.0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Human player did not win');
    });

    it('rejects games with illegal moves (occupied cell)', () => {
      const illegalHistory: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 0, vanished: null }, // O attempts to play in cell 0
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 2, vanished: null },
      ];
      const result = verifyBotGame(illegalHistory, 'medium', 10.0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Illegal move');
    });

    it('rejects games with wrong turn order', () => {
      const wrongTurnHistory: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'X', cell: 1, vanished: null }, // Two X moves consecutively
      ];
      const result = verifyBotGame(wrongTurnHistory, 'medium', 10.0);
      expect(result.valid).toBe(false);
    });
  });

  describe('Recording & Duplicate Prevention', () => {
    const historyA: MoveRecord[] = [
      { player: 'X', cell: 0, vanished: null },
      { player: 'O', cell: 3, vanished: null },
      { player: 'X', cell: 1, vanished: null },
      { player: 'O', cell: 4, vanished: null },
      { player: 'X', cell: 2, vanished: null },
    ];

    it('rejects unauthenticated guest users', async () => {
      await expect(
        recordBotVictory({
          playerId: 'p_guest123',
          playerName: 'Guest 123',
          difficulty: 'medium',
          history: historyA,
          durationSeconds: 12.0,
        })
      ).rejects.toThrow('Only authenticated users can submit leaderboard scores.');
    });

    it('records authenticated user score and personal best', async () => {
      const res = await recordBotVictory({
        playerId: 'user_alice',
        playerName: 'Alice',
        difficulty: 'medium',
        history: historyA,
        durationSeconds: 15.0,
      });

      expect(res.success).toBe(true);
      expect(res.isNewRecord).toBe(true);
      expect(res.record.moves).toBe(3);
      expect(res.record.durationSeconds).toBe(15.0);

      const record = await getPlayerBotRecord('medium', 'user_alice');
      expect(record).not.toBeNull();
      expect(record?.moves).toBe(3);
    });

    it('prevents duplicate submissions of the exact same game', async () => {
      await recordBotVictory({
        playerId: 'user_bob',
        playerName: 'Bob',
        difficulty: 'hard',
        history: historyA,
        durationSeconds: 14.0,
      });

      // Submit identical game again
      await expect(
        recordBotVictory({
          playerId: 'user_bob',
          playerName: 'Bob',
          difficulty: 'hard',
          history: historyA,
          durationSeconds: 14.0,
        })
      ).rejects.toThrow('already been submitted');
    });

    it('updates personal best when player wins in fewer moves', async () => {
      // 7-turn win (X wins in 4 moves: cell 5 vanishes, winning line [0, 1, 2])
      const history4Moves: MoveRecord[] = [
        { player: 'X', cell: 5, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 6, vanished: null },
        { player: 'X', cell: 2, vanished: { symbol: 'X', cell: 5 } },
      ];

      // First submission: 4 moves in 20s
      await recordBotVictory({
        playerId: 'user_carol',
        playerName: 'Carol',
        difficulty: 'hard',
        history: history4Moves,
        durationSeconds: 20.0,
      });

      // Second submission: 3 moves in 12s (different game)
      const history3Moves: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 5, vanished: null },
        { player: 'X', cell: 2, vanished: null },
      ];

      const res2 = await recordBotVictory({
        playerId: 'user_carol',
        playerName: 'Carol',
        difficulty: 'hard',
        history: history3Moves,
        durationSeconds: 12.0,
      });

      expect(res2.isImprovement).toBe(true);
      expect(res2.record.moves).toBe(3);

      const saved = await getPlayerBotRecord('hard', 'user_carol');
      expect(saved?.moves).toBe(3);
      expect(saved?.durationSeconds).toBe(12.0);
    });
  });

  describe('Leaderboard Isolation & Separation', () => {
    it('maintains completely separate rankings for Medium and Hard', async () => {
      const historyMedium: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 2, vanished: null },
      ];

      const historyHard: MoveRecord[] = [
        { player: 'X', cell: 2, vanished: null },
        { player: 'O', cell: 0, vanished: null },
        { player: 'X', cell: 5, vanished: null },
        { player: 'O', cell: 1, vanished: null },
        { player: 'X', cell: 8, vanished: null },
      ];

      await recordBotVictory({
        playerId: 'user_med_champ',
        playerName: 'Med Champ',
        difficulty: 'medium',
        history: historyMedium,
        durationSeconds: 10.0,
      });

      await recordBotVictory({
        playerId: 'user_hard_champ',
        playerName: 'Hard Champ',
        difficulty: 'hard',
        history: historyHard,
        durationSeconds: 18.0,
      });

      const medBoard = await getBotLeaderboard('medium');
      const hardBoard = await getBotLeaderboard('hard');

      expect(medBoard).toHaveLength(1);
      expect(medBoard[0].playerName).toBe('Med Champ');
      expect(medBoard[0].difficulty).toBe('medium');

      expect(hardBoard).toHaveLength(1);
      expect(hardBoard[0].playerName).toBe('Hard Champ');
      expect(hardBoard[0].difficulty).toBe('hard');
    });

    it('ranks players by fewest moves first, then fastest duration', async () => {
      // Player 1: 4 moves in 10s (cell 5 vanishes, winning line [0, 1, 2])
      const hist4MovesFast: MoveRecord[] = [
        { player: 'X', cell: 5, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 6, vanished: null },
        { player: 'X', cell: 2, vanished: { symbol: 'X', cell: 5 } },
      ];

      // Player 2: 3 moves in 25s
      const hist3MovesSlow: MoveRecord[] = [
        { player: 'X', cell: 0, vanished: null },
        { player: 'O', cell: 3, vanished: null },
        { player: 'X', cell: 1, vanished: null },
        { player: 'O', cell: 4, vanished: null },
        { player: 'X', cell: 2, vanished: null },
      ];

      // Player 3: 3 moves in 15s
      const hist3MovesFast: MoveRecord[] = [
        { player: 'X', cell: 6, vanished: null },
        { player: 'O', cell: 0, vanished: null },
        { player: 'X', cell: 7, vanished: null },
        { player: 'O', cell: 1, vanished: null },
        { player: 'X', cell: 8, vanished: null },
      ];

      await recordBotVictory({
        playerId: 'user_p1',
        playerName: 'P1 (4 moves, 10s)',
        difficulty: 'hard',
        history: hist4MovesFast,
        durationSeconds: 10.0,
      });

      await recordBotVictory({
        playerId: 'user_p2',
        playerName: 'P2 (3 moves, 25s)',
        difficulty: 'hard',
        history: hist3MovesSlow,
        durationSeconds: 25.0,
      });

      await recordBotVictory({
        playerId: 'user_p3',
        playerName: 'P3 (3 moves, 15s)',
        difficulty: 'hard',
        history: hist3MovesFast,
        durationSeconds: 15.0,
      });

      const board = await getBotLeaderboard('hard');
      expect(board).toHaveLength(3);

      // Rank 1: P3 (3 moves, 15s)
      expect(board[0].playerId).toBe('user_p3');
      expect(board[0].rank).toBe(1);
      expect(board[0].moves).toBe(3);

      // Rank 2: P2 (3 moves, 25s)
      expect(board[1].playerId).toBe('user_p2');
      expect(board[1].rank).toBe(2);
      expect(board[1].moves).toBe(3);

      // Rank 3: P1 (4 moves, 10s)
      expect(board[2].playerId).toBe('user_p1');
      expect(board[2].rank).toBe(3);
      expect(board[2].moves).toBe(4);
    });
  });
});
