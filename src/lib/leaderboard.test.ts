import { describe, it, expect, beforeEach } from 'vitest';
import { generateGuestName, getPlayerName, setPlayerName } from './player';
import {
  recordGameResult,
  recordMatchResult,
  getLeaderboard,
  resetLeaderboard,
  markGameRecorded,
  registerRoomPlayerSession,
  registerRoomGuestSession,
  getRoomSeatUser,
} from './leaderboard';

describe('Player Names & Authentication State', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  });

  it('returns guest name when user is not signed in', () => {
    const guest = getPlayerName(null);
    expect(guest).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    // Preserves guest name in localStorage
    expect(getPlayerName(undefined)).toBe(guest);
  });

  it('returns Google name when signed in without altering guest name', () => {
    // 1. Establish guest name first
    const guest = getPlayerName(null);

    // 2. User signs in with Google
    const googleUser = { name: 'Alex Rivera', id: 'usr_google_123' };
    const signedInName = getPlayerName(googleUser);
    expect(signedInName).toBe('Alex Rivera');

    // 3. Guest name in storage is not deleted
    const guestStorage = localStorage.getItem('vanish_xo_guest_name');
    expect(guestStorage).toBe(guest);

    // 4. User signs out - immediately returns original guest name
    const signedOutName = getPlayerName(null);
    expect(signedOutName).toBe(guest);
  });

  it('uses custom edited name for signed-in user instead of Google name', () => {
    const googleUser = { name: 'Alex Rivera', id: 'usr_google_456' };

    // Set custom name for signed in user
    setPlayerName('CyberNinja', true, googleUser.id);
    expect(getPlayerName(googleUser)).toBe('CyberNinja');

    // Sign out reverts to guest name, not the custom name
    const signedOutName = getPlayerName(null);
    expect(signedOutName).not.toBe('CyberNinja');
    expect(signedOutName).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);

    // Sign back in restores edited name
    expect(getPlayerName(googleUser)).toBe('CyberNinja');
  });
});

describe('Leaderboard & Guest Names', () => {
  beforeEach(async () => {
    await resetLeaderboard();
  });

  describe('generateGuestName', () => {
    it('generates a stable name for the same player ID', () => {
      const name1 = generateGuestName('p_12345');
      const name2 = generateGuestName('p_12345');
      expect(name1).toBe(name2);
      expect(name1).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    });

    it('generates names with adjective, noun, and number format', () => {
      const name = generateGuestName('p_sample99');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(5);
    });

    it('generates different names for different player IDs', () => {
      const nameA = generateGuestName('player_alpha');
      const nameB = generateGuestName('player_beta');
      expect(nameA).not.toBe(nameB);
    });
  });

  describe('Bot Games & Leaderboard', () => {
    it('throws error and NEVER records a bot game to the leaderboard', async () => {
      await expect(
        recordGameResult({
          playerId: 'test_player_1',
          opponentId: 'bot-medium',
          result: 'win',
        })
      ).rejects.toThrow(/unrated/i);

      const board = await getLeaderboard();
      expect(board.length).toBe(0);
    });

    it('rejects guest player IDs starting with p_ or guest', async () => {
      await expect(
        recordGameResult({
          playerId: 'p_123456789',
          opponentId: 'test_human_p2',
          result: 'win',
        })
      ).rejects.toThrow(/Guests cannot be ranked/i);

      await expect(
        recordGameResult({
          playerId: 'guest',
          opponentId: 'test_human_p2',
          result: 'win',
        })
      ).rejects.toThrow(/Guests cannot be ranked/i);
    });

    it('records valid human games using guest name if player name is omitted', async () => {
      const pId = 'test_human_p1';
      const expectedGuestName = generateGuestName(pId);

      const res = await recordGameResult({
        playerId: pId,
        opponentId: 'test_human_p2',
        result: 'win',
      });

      expect(res.success).toBe(true);
      expect(res.player.name).toBe(expectedGuestName);

      const board = await getLeaderboard();
      expect(board.length).toBe(1);
      expect(board[0].playerName).toBe(expectedGuestName);
    });

    it('resets all leaderboard entries and profiles', async () => {
      await recordGameResult({
        playerId: 'player_to_wipe',
        playerName: 'WipeMe',
        opponentId: 'human_opponent',
        result: 'win',
      });

      let board = await getLeaderboard();
      expect(board.length).toBe(1);

      await resetLeaderboard();

      board = await getLeaderboard();
      expect(board.length).toBe(0);
    });

    it('records match result updating both players ratings, wins, and losses', async () => {
      const res = await recordMatchResult('usr_alice', 'Alice', 'usr_bob', 'Bob', 1);

      expect(res.success).toBe(true);
      expect(res.playerA.wins).toBe(1);
      expect(res.playerA.gamesPlayed).toBe(1);
      expect(res.playerA.rating).toBeGreaterThan(1000);
      expect(res.deltaA).toBeGreaterThan(0);

      expect(res.playerB.losses).toBe(1);
      expect(res.playerB.gamesPlayed).toBe(1);
      expect(res.playerB.rating).toBeLessThan(1000);
      expect(res.deltaB).toBeLessThan(0);

      const board = await getLeaderboard();
      expect(board.length).toBe(2);
      expect(board[0].playerName).toBe('Alice');
      expect(board[1].playerName).toBe('Bob');
    });

    it('rejects match result if either player is a guest', async () => {
      await expect(
        recordMatchResult('p_guest123', 'Guest 1', 'usr_bob', 'Bob', 1)
      ).rejects.toThrow(/Both players must be signed in/i);

      await expect(
        recordMatchResult('usr_alice', 'Alice', 'p_guest456', 'Guest 2', 1)
      ).rejects.toThrow(/Both players must be signed in/i);
    });

    it('prevents double-counting with markGameRecorded', async () => {
      const isFirst = await markGameRecorded('game_unique_123');
      expect(isFirst).toBe(true);

      const isSecond = await markGameRecorded('game_unique_123');
      expect(isSecond).toBe(false);
    });

    it('stores and retrieves verified room player sessions', async () => {
      await registerRoomPlayerSession('ROOM1', 0, 'pid_1', 'usr_google_1', 'Player One');
      await registerRoomGuestSession('ROOM1', 1, 'pid_2');

      const user0 = await getRoomSeatUser('ROOM1', 0, 'pid_1');
      expect(user0).toEqual({ userId: 'usr_google_1', name: 'Player One', isGuest: false });

      const user1 = await getRoomSeatUser('ROOM1', 1, 'pid_2');
      expect(user1?.isGuest).toBe(true);
    });
  });
});

