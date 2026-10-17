import { describe, it, expect } from 'vitest';
import {
  createGame,
  createInitialState,
  getConfigForPlayers,
  getLegalMoves,
  placeMark,
  getNextVanish,
  getWinner,
  getMarkAgeIndex,
  getMediumBotMove,
  getHardBotMove,
  getMoveInsights,
  getBoardAtMove,
  GameState,
} from './game';
import { generateRoomCode, isValidRoomCode, ROOM_CODE_CHARS } from './types';

describe('Vanish XO - Core Game Logic & Rules', () => {
  it('initializes with empty board and X turn', () => {
    const state = createInitialState();
    expect(state.board.every((cell) => cell === null)).toBe(true);
    expect(state.movesX).toEqual([]);
    expect(state.movesO).toEqual([]);
    expect(state.turn).toBe('X');
    expect(state.winner).toBeNull();
    expect(state.lastVanished).toBeNull();
    expect(getNextVanish(state, 'X')).toBeNull();
    expect(getNextVanish(state, 'O')).toBeNull();
  });

  it('allows players to place marks alternately up to 3 each', () => {
    let state = createInitialState();

    // Move 1: X at 0
    state = placeMark(state, 0).nextState;
    expect(state.board[0]).toBe('X');
    expect(state.movesX).toEqual([0]);
    expect(state.turn).toBe('O');

    // Move 2: O at 1
    state = placeMark(state, 1).nextState;
    expect(state.board[1]).toBe('O');
    expect(state.movesO).toEqual([1]);
    expect(state.turn).toBe('X');

    // Move 3: X at 3
    state = placeMark(state, 3).nextState;
    expect(state.movesX).toEqual([0, 3]);

    // Move 4: O at 4
    state = placeMark(state, 4).nextState;
    expect(state.movesO).toEqual([1, 4]);

    // Move 5: X at 6 (X now has 3 marks: [0, 3, 6])
    state = placeMark(state, 6).nextState;
    expect(state.movesX).toEqual([0, 3, 6]);

    // X has won with column 0, 3, 6!
    expect(state.winner).toBe('X');
    expect(state.winningLine).toEqual([0, 3, 6]);
  });

  it('identifies the next mark to vanish when a player has 3 marks', () => {
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X: [0]
    expect(getNextVanish(state, 'X')).toBeNull();

    state = placeMark(state, 1).nextState; // O: [1]
    state = placeMark(state, 2).nextState; // X: [0, 2]
    expect(getNextVanish(state, 'X')).toBeNull();

    state = placeMark(state, 4).nextState; // O: [1, 4]
    state = placeMark(state, 8).nextState; // X: [0, 2, 8]
    // Now X has 3 marks. Oldest is 0.
    expect(getNextVanish(state, 'X')).toBe(0);

    state = placeMark(state, 7).nextState; // O: [1, 4, 7] (O wins col 1, 4, 7)
    expect(getNextVanish(state, 'O')).toBe(1);
  });

  it('removes oldest mark when 4th mark is placed', () => {
    let state = createInitialState();
    // Non-winning setup
    // Moves: X: 0, 2, 5. O: 1, 3, 7.
    state = placeMark(state, 0).nextState; // X: [0]
    state = placeMark(state, 1).nextState; // O: [1]
    state = placeMark(state, 2).nextState; // X: [0, 2]
    state = placeMark(state, 3).nextState; // O: [1, 3]
    state = placeMark(state, 5).nextState; // X: [0, 2, 5]
    state = placeMark(state, 7).nextState; // O: [1, 3, 7]

    expect(state.movesX).toEqual([0, 2, 5]);
    expect(state.board[0]).toBe('X');
    expect(state.winner).toBeNull();

    // Now X places 4th mark at 8. Oldest mark (0) MUST disappear!
    const step4 = placeMark(state, 8);
    state = step4.nextState;

    expect(state.board[0]).toBeNull(); // cell 0 vanished
    expect(state.board[8]).toBe('X'); // cell 8 placed
    expect(state.movesX).toEqual([2, 5, 8]); // queue updated
    expect(state.lastVanished).toEqual({ player: 'X', cell: 0 });
    expect(state.movesX.length).toBe(3);
  });

  it('enforces order: oldest mark vanishes BEFORE win check (crucial rule)', () => {
    // Suppose X has marks at 0, 1, 6.
    // If X places mark at 2, cells 0, 1, 2 WOULD be a row IF 0 remained!
    // But since 0 is the oldest mark, 0 MUST vanish first!
    // Remaining marks for X will be [1, 6, 2], which is NOT a winning line.
    let state = createInitialState();

    state = placeMark(state, 0).nextState; // X: [0] (oldest)
    state = placeMark(state, 3).nextState; // O: [3]
    state = placeMark(state, 1).nextState; // X: [0, 1]
    state = placeMark(state, 4).nextState; // O: [3, 4]
    state = placeMark(state, 6).nextState; // X: [0, 1, 6]
    state = placeMark(state, 8).nextState; // O: [3, 4, 8]

    // X moves to cell 2.
    // If win check happened before removal, [0, 1, 2] would win.
    // With removal FIRST: cell 0 vanishes, X has [1, 6, 2]. No win!
    state = placeMark(state, 2).nextState;

    expect(state.board[0]).toBeNull(); // cell 0 is gone!
    expect(state.movesX).toEqual([1, 6, 2]);
    expect(state.winner).toBeNull(); // NOT a win!
    expect(state.turn).toBe('O'); // game continues
  });



  it('correctly detects a win on the same move as a vanish without interfering lines', () => {
    let state = createInitialState();

    state = placeMark(state, 8).nextState; // X: [8] (oldest)
    state = placeMark(state, 3).nextState; // O: [3]
    state = placeMark(state, 0).nextState; // X: [8, 0]
    state = placeMark(state, 4).nextState; // O: [3, 4]
    state = placeMark(state, 1).nextState; // X: [8, 0, 1]
    state = placeMark(state, 7).nextState; // O: [3, 4, 7] (not a winning line)

    // X has [8, 0, 1]. Oldest is 8.
    expect(getNextVanish(state, 'X')).toBe(8);

    // X places at 2.
    // Cell 8 vanishes!
    // X now has [0, 1, 2] -> ROW 1 WIN!
    state = placeMark(state, 2).nextState;

    expect(state.board[8]).toBeNull();
    expect(state.lastVanished).toEqual({ player: 'X', cell: 8 });
    expect(state.movesX).toEqual([0, 1, 2]);
    expect(state.winner).toBe('X');
    expect(state.winningLine).toEqual([0, 1, 2]);
  });

  it('prevents placing marks on already occupied cells', () => {
    let state = createInitialState();
    state = placeMark(state, 4).nextState;
    const result = placeMark(state, 4);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cell is already occupied');
  });

  it('prevents placing marks after game is over', () => {
    let state = createInitialState();
    // X wins: 0, 1, 2
    state = placeMark(state, 0).nextState;
    state = placeMark(state, 3).nextState;
    state = placeMark(state, 1).nextState;
    state = placeMark(state, 4).nextState;
    state = placeMark(state, 2).nextState; // X wins row [0, 1, 2]
    expect(state.winner).toBe('X');

    const result = placeMark(state, 8);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Game is already over');
  });

  it('accurately calculates mark ages and identify warning state', () => {
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X: [0]
    state = placeMark(state, 3).nextState; // O: [3]
    state = placeMark(state, 1).nextState; // X: [0, 1]
    state = placeMark(state, 4).nextState; // O: [3, 4]
    state = placeMark(state, 6).nextState; // X: [0, 1, 6]

    // X has 3 marks: 0 (oldest), 1 (middle), 6 (newest)
    const age0 = getMarkAgeIndex(state, 0);
    expect(age0).toEqual({ player: 'X', ageIndex: 0, isOldestOfThree: true });

    const age1 = getMarkAgeIndex(state, 1);
    expect(age1).toEqual({ player: 'X', ageIndex: 1, isOldestOfThree: false });

    const age6 = getMarkAgeIndex(state, 6);
    expect(age6).toEqual({ player: 'X', ageIndex: 2, isOldestOfThree: false });

    // O has 2 marks: 3 (older), 4 (newest)
    const age3 = getMarkAgeIndex(state, 3);
    expect(age3).toEqual({ player: 'O', ageIndex: 1, isOldestOfThree: false });
  });

  it('bot medium blocks opponent winning move', () => {
    // Setup where X is about to win with 0, 1 and cell 2 is open.
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X: [0]
    state = placeMark(state, 7).nextState; // O: [7]
    state = placeMark(state, 1).nextState; // X: [0, 1]
    // Turn is O. X threatens to win at 2!
    expect(state.turn).toBe('O');

    const botMove = getMediumBotMove(state);
    expect(botMove).toBe(2); // Bot must block cell 2!
  });

  it('bot medium takes immediate winning move over blocking', () => {
    // Setup where O can win at cell 8, and X could also win at cell 2.
    // Bot should prioritize winning!
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X at 0
    state = placeMark(state, 6).nextState; // O at 6
    state = placeMark(state, 1).nextState; // X at 1 (X threatens 2)
    state = placeMark(state, 7).nextState; // O at 7 (O threatens 8)
    state = placeMark(state, 5).nextState; // X at 5 (neutral move)
    // Turn is O. Bot can win at 8 [6, 7, 8]!
    expect(state.turn).toBe('O');

    const botMove = getMediumBotMove(state);
    expect(botMove).toBe(8); // Bot takes the win!
  });

  it('bot hard minimax chooses optimal moves and handles game loop', () => {
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X at 0
    expect(state.turn).toBe('O');

    const hardMove = getHardBotMove(state);
    // Best response to corner opening is center (4)
    expect(hardMove).toBe(4);
  });

  it('bot hard minimax blocks opponent winning threat', () => {
    let state = createInitialState();
    state = placeMark(state, 0).nextState; // X at 0
    state = placeMark(state, 4).nextState; // O at 4
    state = placeMark(state, 1).nextState; // X at 1 (threatens 2)
    expect(state.turn).toBe('O');

    const hardMove = getHardBotMove(state);
    expect(hardMove).toBe(2); // Must block at 2!
  });

  it('pure getWinner function returns correct winner and winning line', () => {
    expect(getWinner([0, 1, 2])).toEqual({ winner: true, line: [0, 1, 2] });
    expect(getWinner([0, 4, 8])).toEqual({ winner: true, line: [0, 4, 8] });
    expect(getWinner([0, 1, 5])).toEqual({ winner: false, line: null });
    expect(getWinner([0, 1])).toEqual({ winner: false, line: null });
  });

  describe('Board Configuration & Safety Rules', () => {
    it('createGame for 2, 3 and 4 players returns the right board size', () => {
      // 2 players = 3x3 board (9 cells)
      const game2 = createGame(2);
      expect(game2.board.length).toBe(9);
      expect(game2.config.gridSize).toBe(3);
      expect(game2.config.totalCells).toBe(9);
      expect(game2.config.playerCount).toBe(2);

      // 3 players = 5x5 board (25 cells)
      const game3 = createGame(3);
      expect(game3.board.length).toBe(25);
      expect(game3.config.gridSize).toBe(5);
      expect(game3.config.totalCells).toBe(25);
      expect(game3.config.playerCount).toBe(3);

      // 4 players = 6x6 board (36 cells)
      const game4 = createGame(4);
      expect(game4.board.length).toBe(36);
      expect(game4.config.gridSize).toBe(6);
      expect(game4.config.totalCells).toBe(36);
      expect(game4.config.playerCount).toBe(4);

      // getConfigForPlayers matches
      expect(getConfigForPlayers(2).totalCells).toBe(9);
      expect(getConfigForPlayers(3).totalCells).toBe(25);
      expect(getConfigForPlayers(4).totalCells).toBe(36);
    });

    it('createGame validates boardCells > players * marksPerPlayer', () => {
      // 4 players * 3 marks = 12 marks. 9 cells is invalid (9 <= 12)
      expect(() => {
        createGame({
          playerCount: 4,
          gridSize: 3,
          totalCells: 9,
          marksPerPlayer: 3,
          winStreak: 3,
        });
      }).toThrow(/must be strictly greater than players \* marksPerPlayer/);
    });

    it('a full board still produces a legal move by removing oldest mark first', () => {
      const state = createGame(2);
      // Manually simulate a full board with 9 occupied cells (non-winning configuration)
      state.board = ['X', 'X', 'O', 'O', 'O', 'X', 'X', 'O', 'X'];
      state.movesX = [0, 1, 5];
      state.movesO = [2, 3, 4];
      state.turn = 'X';

      // Confirm no empty cell exists
      expect(state.board.every((c) => c !== null)).toBe(true);

      // getLegalMoves must return the cell of X's oldest mark (cell 0)
      const legalMoves = getLegalMoves(state);
      expect(legalMoves).toEqual([0]);

      // Placing at the freed cell succeeds: cell 0 vanishes and is placed with X
      const { nextState, success } = placeMark(state, 0);
      expect(success).toBe(true);
      expect(nextState.lastVanished).toEqual({ player: 'X', cell: 0 });
      expect(nextState.board[0]).toBe('X');
      expect(nextState.movesX).toEqual([1, 5, 0]);
      expect(nextState.winner).toBeNull();
      expect(nextState.turn).toBe('O');
    });
  });

  describe('Room Code Generation and Validation', () => {
    it('rejects malformed room codes and forbidden characters', () => {
      expect(isValidRoomCode('')).toBe(false);
      expect(isValidRoomCode('ABC')).toBe(false); // Too short
      expect(isValidRoomCode('ABCDEF')).toBe(false); // Too long
      expect(isValidRoomCode('ABCD0')).toBe(false); // Contains 0
      expect(isValidRoomCode('ABCDO')).toBe(false); // Contains O
      expect(isValidRoomCode('ABCD1')).toBe(false); // Contains 1
      expect(isValidRoomCode('ABCDI')).toBe(false); // Contains I
      expect(isValidRoomCode('ABC!5')).toBe(false); // Non-alphanumeric

      // Trims and uppercases correctly for valid 5-char codes
      expect(isValidRoomCode('  23456  ')).toBe(true);
      expect(isValidRoomCode('abcde')).toBe(true);
    });

    it('generates valid 5-character codes without forbidden characters', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code.length).toBe(5);
        expect(isValidRoomCode(code)).toBe(true);
        expect(code).not.toMatch(/[01OI]/);
      }
    });

    it('simulates 10,000 generated codes and asserts no forbidden characters and uniform spread', () => {
      const counts: Record<string, number> = {};
      for (const char of ROOM_CODE_CHARS) {
        counts[char] = 0;
      }

      const totalCodes = 10000;
      for (let i = 0; i < totalCodes; i++) {
        const code = generateRoomCode();
        expect(code.length).toBe(5);
        expect(code).not.toMatch(/[01OI]/);

        for (const ch of code) {
          counts[ch] = (counts[ch] || 0) + 1;
        }
      }

      // 10,000 codes * 5 characters = 50,000 characters
      // Expected frequency per character = 50,000 / 32 = 1,562.5
      // With standard deviation ~39, each character frequency must easily be within [1200, 1950]
      for (const char of ROOM_CODE_CHARS) {
        expect(counts[char]).toBeGreaterThan(1200);
        expect(counts[char]).toBeLessThan(1950);
      }
    });
  });

  describe('Move History, Vanishing & Insights', () => {
    it('move history records vanishes correctly', () => {
      let state = createInitialState();
      // Moves 1-6 (3 for X, 3 for O)
      state = placeMark(state, 0).nextState; // X at 0
      state = placeMark(state, 1).nextState; // O at 1
      state = placeMark(state, 2).nextState; // X at 2
      state = placeMark(state, 3).nextState; // O at 3
      state = placeMark(state, 4).nextState; // X at 4
      state = placeMark(state, 5).nextState; // O at 5

      // Move 7: X has 3 marks ([0, 2, 4]). X plays at 7.
      // X's oldest mark (at 0) must vanish first!
      state = placeMark(state, 7).nextState;
      expect(state.history.length).toBe(7);
      const move7 = state.history[6];
      expect(move7.player).toBe('X');
      expect(move7.cell).toBe(7);
      expect(move7.vanished).toEqual({ symbol: 'X', cell: 0 });

      // Move 8: O has 3 marks ([1, 3, 5]). O plays at 8.
      // O's oldest mark (at 1) must vanish first!
      state = placeMark(state, 8).nextState;
      expect(state.history.length).toBe(8);
      const move8 = state.history[7];
      expect(move8.player).toBe('O');
      expect(move8.cell).toBe(8);
      expect(move8.vanished).toEqual({ symbol: 'O', cell: 1 });
    });

    it('win on the same move as a vanish shows the ghost data', () => {
      let state = createInitialState();
      // Setup:
      // X moves:
      // 1. X at 8 (oldest, will vanish on 4th move)
      // 2. O at 3
      // 3. X at 0
      // 4. O at 4
      // 5. X at 1
      // 6. O at 5
      // X currently has: [8, 0, 1]
      // On move 7: X plays 2!
      // Vanish happens FIRST: mark 8 vanishes!
      // Then mark 2 is placed.
      // X now has [0, 1, 2] -> WINNER X!
      state = placeMark(state, 8).nextState; // X at 8
      state = placeMark(state, 3).nextState; // O at 3
      state = placeMark(state, 0).nextState; // X at 0
      state = placeMark(state, 4).nextState; // O at 4
      state = placeMark(state, 1).nextState; // X at 1
      state = placeMark(state, 6).nextState; // O at 6 (not a line: [3, 4, 6])

      const winMove = placeMark(state, 2).nextState;
      expect(winMove.winner).toBe('X');
      expect(winMove.winningLine).toEqual([0, 1, 2]);
      // Shows ghost data:
      expect(winMove.lastVanished).toEqual({ player: 'X', cell: 8 });
      expect(winMove.lastMoveCell).toBe(2);
      const lastHistoryItem = winMove.history[winMove.history.length - 1];
      expect(lastHistoryItem.vanished).toEqual({ symbol: 'X', cell: 8 });
      expect(lastHistoryItem.cell).toBe(2);
      expect(lastHistoryItem.player).toBe('X');
    });

    it('getMoveInsights flags a missed block', () => {
      let state = createInitialState();
      // Move 1: X at 0
      state = placeMark(state, 0).nextState;
      // Move 2: O at 4
      state = placeMark(state, 4).nextState;
      // Move 3: X at 1 (X threatens win on cell 2!)
      state = placeMark(state, 1).nextState;
      // Move 4: O should block at 2, but mistakenly plays at 8 (missed block!)
      state = placeMark(state, 8).nextState;

      const insights = getMoveInsights(state.history, state.config);
      expect(insights.length).toBe(4);
      // Move 1, 2, 3 had no winning replies available
      expect(insights[0].hasWarning).toBe(false);
      expect(insights[1].hasWarning).toBe(false);
      expect(insights[2].hasWarning).toBe(false);

      // Move 4 (O missed block on cell 2): X has winning reply on cell 2!
      expect(insights[3].hasWarning).toBe(true);
      expect(insights[3].isTrap).toBe(true);

      // Reconstruct board at move 4
      const step4 = getBoardAtMove(state.history, 3, state.config);
      expect(step4).not.toBeNull();
      expect(step4?.board[8]).toBe('O');
      expect(step4?.lastMove.cell).toBe(8);
    });

    it('Hard bot does not walk into the vanish trap when a safe alternative exists', () => {
      // Setup position:
      // Human X has marks at 1 and 2 (line [0, 1, 2])
      // Bot O has 3 marks: [0, 3, 4] where cell 0 is O's oldest mark!
      // Cell 0 is currently blocking X's winning line [0, 1, 2].
      // Bot O has marks at 3 and 4. Cell 5 is empty.
      // If Bot plays 5, Bot wins with [3, 4, 5]!
      // If Bot plays cell 6, O's mark at 0 vanishes, the cell opens, and X wins.
      const state: GameState = {
        config: getConfigForPlayers(2),
        board: [
          'O', 'X', 'X',
          'O', 'O', null,
          null, 'X', null,
        ],
        movesX: [7, 1, 2],
        movesO: [0, 3, 4], // 0 is oldest of O
        turn: 'O',
        winner: null,
        winningLine: null,
        lastVanished: null,
        moveCount: 6,
        history: [],
        lastMoveCell: 4,
      };

      const hardMove = getHardBotMove(state);
      // Hard bot must choose 5 (immediate win) and NOT walk into the trap by playing 6 or 8!
      expect(hardMove).toBe(5);

      // Medium bot also avoids walking into the trap on this position
      const mediumMove = getMediumBotMove(state);
      expect(mediumMove).toBe(5);
    });

    it('Hard bot uses the vanish trap trick against the human when available', () => {
      // Setup position:
      // Human X has 3 marks: [0, 5, 7] where cell 0 is X's oldest mark!
      // Bot O has mark at 1. Cells 2, 3, 4, 6, 8 are available.
      // Notice X has NO immediate two-in-a-row threats.
      // If Bot O plays cell 2, Bot sets up [0, 1, 2].
      // On the very next turn, Human X MUST move because X has 3 marks.
      // When X moves, X's mark at cell 0 vanishes, opening cell 0 for Bot O to win!
      const state: GameState = {
        config: getConfigForPlayers(2),
        board: [
          'X', 'O', null,
          null, null, 'X',
          null, 'X', null,
        ],
        movesX: [0, 5, 7], // 0 is X's oldest mark, about to vanish!
        movesO: [1],
        turn: 'O',
        winner: null,
        winningLine: null,
        lastVanished: null,
        moveCount: 4,
        history: [],
        lastMoveCell: 7,
      };

      const hardMove = getHardBotMove(state);
      // Hard bot recognizes that playing 2 sets up the vanish trap on cell 0
      expect(hardMove).toBe(2);

      // Verify that after Bot plays 2 and Human makes any move, cell 0 is opened and Bot wins
      const afterBotMove = placeMark(state, hardMove).nextState;
      expect(afterBotMove.turn).toBe('X');
      // Human moves anywhere (e.g. cell 3)
      const afterHumanMove = placeMark(afterBotMove, 3).nextState;
      // Human's oldest mark at cell 0 vanished!
      expect(afterHumanMove.board[0]).toBeNull();
      expect(afterHumanMove.lastVanished?.cell).toBe(0);
      expect(afterHumanMove.turn).toBe('O');

      // Bot now plays into the opened cell 0 and wins!
      const winningBotMove = placeMark(afterHumanMove, 0).nextState;
      expect(winningBotMove.winner).toBe('O');
      expect(winningBotMove.winningLine).toEqual([0, 1, 2]);
    });
  });
});

