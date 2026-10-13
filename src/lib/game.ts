import {
  MarkSymbol,
  MARK_SYMBOLS,
  PlayerSeat,
  RoomState,
  VanishedEvent,
} from './types';

export type Player = 'X' | 'O';

export const WINNING_LINES: readonly [number, number, number][] = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Col 1
  [1, 4, 7], // Col 2
  [2, 5, 8], // Col 3
  [0, 4, 8], // Diag 1
  [2, 4, 6], // Diag 2
];

export interface VanishedInfo {
  player: Player;
  cell: number;
}

export interface GameState {
  board: (Player | null)[];
  movesX: number[]; // oldest at index 0, newest at end (max 3)
  movesO: number[]; // oldest at index 0, newest at end (max 3)
  turn: Player;
  winner: Player | null;
  winningLine: [number, number, number] | null;
  lastVanished: VanishedInfo | null;
  moveCount: number;
}

export function createInitialState(startingPlayer: Player = 'X'): GameState {
  return {
    board: Array(9).fill(null),
    movesX: [],
    movesO: [],
    turn: startingPlayer,
    winner: null,
    winningLine: null,
    lastVanished: null,
    moveCount: 0,
  };
}

/**
 * Returns the cell index of the mark that will vanish on the player's next move.
 * Returns null if the player currently has fewer than 3 marks.
 */
export function getNextVanish(state: GameState, player: Player): number | null {
  const moves = player === 'X' ? state.movesX : state.movesO;
  if (moves.length >= 3) {
    return moves[0];
  }
  return null;
}

/**
 * Checks if the given list of cell indices contains any winning line.
 */
export function checkWin(moves: number[]): [number, number, number] | null {
  if (moves.length < 3) return null;
  const moveSet = new Set(moves);
  for (const line of WINNING_LINES) {
    if (moveSet.has(line[0]) && moveSet.has(line[1]) && moveSet.has(line[2])) {
      return line;
    }
  }
  return null;
}

/**
 * Pure function to get winner info from a player's moves list.
 */
export function getWinner(moves: number[]): { winner: boolean; line: [number, number, number] | null } {
  const line = checkWin(moves);
  return { winner: line !== null, line };
}

/**
 * Returns list of empty cell indices on the board.
 */
export function getAvailableMoves(state: GameState): number[] {
  if (state.winner !== null) return [];
  const available: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) {
      available.push(i);
    }
  }
  return available;
}

/**
 * Places a mark for the current turn player.
 * Rule:
 * 1. Validate move (game active, cell in bounds, cell empty).
 * 2. If the current player has 3 marks, remove the OLDEST mark first.
 * 3. Add the new mark to the board and to the player's queue.
 * 4. Check for a win AFTER removal and placement.
 * 5. Switch turn if game is not won.
 */
export function placeMark(
  state: GameState,
  cellIndex: number
): { nextState: GameState; success: boolean; error?: string } {
  if (state.winner !== null) {
    return { nextState: state, success: false, error: 'Game is already over' };
  }
  if (cellIndex < 0 || cellIndex > 8) {
    return { nextState: state, success: false, error: 'Invalid cell index' };
  }
  if (state.board[cellIndex] !== null) {
    return { nextState: state, success: false, error: 'Cell is already occupied' };
  }

  const currentPlayer = state.turn;
  const newBoard = [...state.board];
  let newMovesX = [...state.movesX];
  let newMovesO = [...state.movesO];
  let lastVanished: VanishedInfo | null = null;

  if (currentPlayer === 'X') {
    if (newMovesX.length >= 3) {
      const oldestCell = newMovesX[0];
      newBoard[oldestCell] = null;
      newMovesX = newMovesX.slice(1);
      lastVanished = { player: 'X', cell: oldestCell };
    }
    newBoard[cellIndex] = 'X';
    newMovesX.push(cellIndex);
  } else {
    if (newMovesO.length >= 3) {
      const oldestCell = newMovesO[0];
      newBoard[oldestCell] = null;
      newMovesO = newMovesO.slice(1);
      lastVanished = { player: 'O', cell: oldestCell };
    }
    newBoard[cellIndex] = 'O';
    newMovesO.push(cellIndex);
  }

  // Check win for the player who just moved
  const movesToCheck = currentPlayer === 'X' ? newMovesX : newMovesO;
  const winningLine = checkWin(movesToCheck);
  const winner = winningLine ? currentPlayer : null;
  const nextTurn = winner ? currentPlayer : (currentPlayer === 'X' ? 'O' : 'X');

  const nextState: GameState = {
    board: newBoard,
    movesX: newMovesX,
    movesO: newMovesO,
    turn: nextTurn,
    winner,
    winningLine,
    lastVanished,
    moveCount: state.moveCount + 1,
  };

  return { nextState, success: true };
}

/**
 * Returns mark age index for a given cell (if occupied):
 * - 2: newest (just placed)
 * - 1: middle
 * - 0: oldest (first placed)
 * Returns -1 if cell is empty or not in moves.
 */
export function getMarkAgeIndex(
  state: GameState,
  cellIndex: number
): { player: Player; ageIndex: 0 | 1 | 2; isOldestOfThree: boolean } | null {
  const mark = state.board[cellIndex];
  if (!mark) return null;

  const moves = mark === 'X' ? state.movesX : state.movesO;
  const indexInQueue = moves.indexOf(cellIndex);
  if (indexInQueue === -1) return null;

  // In queue: index 0 is oldest, index (length - 1) is newest
  // Map to 0 (oldest), 1 (middle), 2 (newest)
  let ageIndex: 0 | 1 | 2 = 2;
  if (moves.length === 3) {
    ageIndex = indexInQueue as 0 | 1 | 2;
  } else if (moves.length === 2) {
    ageIndex = (indexInQueue + 1) as 1 | 2;
  } else {
    ageIndex = 2;
  }

  const isOldestOfThree = moves.length === 3 && indexInQueue === 0;

  return { player: mark, ageIndex, isOldestOfThree };
}

/* =========================================================================
   BOT AI IMPLEMENTATIONS: Easy, Medium, Hard
   Bot is typically 'O' playing against human 'X'
   ========================================================================= */

/**
 * Easy: picks a random available cell.
 */
export function getEasyBotMove(state: GameState): number {
  const available = getAvailableMoves(state);
  if (available.length === 0) return -1;
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

/**
 * Medium:
 * 1. Checks if bot ('O') can win immediately (taking vanishing into account).
 * 2. Checks if opponent ('X') could win on their next turn, and blocks that cell.
 * 3. Prefers center cell (4), then corners [0, 2, 6, 8], then edges.
 */
export function getMediumBotMove(state: GameState): number {
  const available = getAvailableMoves(state);
  if (available.length === 0) return -1;

  const botPlayer = state.turn;
  const opponentPlayer: Player = botPlayer === 'X' ? 'O' : 'X';

  // 1. Can bot win on this move?
  for (const move of available) {
    const { nextState, success } = placeMark(state, move);
    if (success && nextState.winner === botPlayer) {
      return move;
    }
  }

  // 2. Can opponent win on their next turn if we don't block?
  // We simulate opponent playing as current turn
  const opponentSimState: GameState = {
    ...state,
    turn: opponentPlayer,
  };
  const winningBlocks: number[] = [];
  for (const move of available) {
    const { nextState, success } = placeMark(opponentSimState, move);
    if (success && nextState.winner === opponentPlayer) {
      winningBlocks.push(move);
    }
  }
  if (winningBlocks.length > 0) {
    return winningBlocks[0];
  }

  // 3. Strategic fallback: prefer center (4) if available
  if (available.includes(4)) return 4;

  // Prefer corners
  const corners = [0, 2, 6, 8].filter((c) => available.includes(c));
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // Otherwise random available
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Hard: Minimax algorithm that simulates the vanishing rule with alpha-beta pruning.
 * Cycle detection via path history prevents infinite loops.
 */
export function getHardBotMove(state: GameState): number {
  const available = getAvailableMoves(state);
  if (available.length === 0) return -1;
  if (available.length === 1) return available[0];

  const maximizingPlayer = state.turn;
  const minimizingPlayer: Player = maximizingPlayer === 'X' ? 'O' : 'X';

  let bestMove = available[0];
  let bestScore = -Infinity;

  // If center is free on first bot move, take it directly
  if (state.moveCount <= 2 && available.includes(4)) {
    return 4;
  }

  const visitedKeys = new Set<string>();

  // Evaluate candidate moves with minimax
  for (const move of available) {
    const { nextState, success } = placeMark(state, move);
    if (!success) continue;

    // Immediate win
    if (nextState.winner === maximizingPlayer) {
      return move;
    }

    const stateKey = getStateKey(nextState);
    visitedKeys.add(stateKey);

    const score = minimax(
      nextState,
      0,
      false,
      -Infinity,
      Infinity,
      maximizingPlayer,
      minimizingPlayer,
      visitedKeys,
      6 // search depth
    );

    visitedKeys.delete(stateKey);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function getStateKey(state: GameState): string {
  return `${state.board.map((c) => c || '-').join('')}|${state.movesX.join('')}|${state.movesO.join('')}|${state.turn}`;
}

function evaluateHeuristic(state: GameState, maximizingPlayer: Player): number {
  if (state.winner === maximizingPlayer) return 1000;
  if (state.winner !== null) return -1000;

  const minimizingPlayer: Player = maximizingPlayer === 'X' ? 'O' : 'X';
  let score = 0;

  // Center control
  if (state.board[4] === maximizingPlayer) score += 30;
  else if (state.board[4] === minimizingPlayer) score -= 30;

  // Evaluate 2-in-a-row threats
  const maxMoves = maximizingPlayer === 'X' ? state.movesX : state.movesO;
  const minMoves = minimizingPlayer === 'X' ? state.movesX : state.movesO;
  const maxSet = new Set(maxMoves);
  const minSet = new Set(minMoves);

  for (const [a, b, c] of WINNING_LINES) {
    const cells = [a, b, c];
    const maxCount = cells.filter((cell) => maxSet.has(cell)).length;
    const minCount = cells.filter((cell) => minSet.has(cell)).length;

    if (maxCount === 2 && minCount === 0) score += 40;
    if (minCount === 2 && maxCount === 0) score -= 50;
  }

  return score;
}

function minimax(
  state: GameState,
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  maximizingPlayer: Player,
  minimizingPlayer: Player,
  visited: Set<string>,
  maxDepth: number
): number {
  if (state.winner === maximizingPlayer) {
    return 1000 - depth;
  }
  if (state.winner === minimizingPlayer) {
    return -1000 + depth;
  }
  if (depth >= maxDepth) {
    return evaluateHeuristic(state, maximizingPlayer);
  }

  const available = getAvailableMoves(state);
  if (available.length === 0) {
    return 0;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of available) {
      const { nextState, success } = placeMark(state, move);
      if (!success) continue;

      const key = getStateKey(nextState);
      if (visited.has(key)) continue; // cycle penalty

      visited.add(key);
      const evaluation = minimax(
        nextState,
        depth + 1,
        false,
        alpha,
        beta,
        maximizingPlayer,
        minimizingPlayer,
        visited,
        maxDepth
      );
      visited.delete(key);

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval === -Infinity ? 0 : maxEval;
  } else {
    let minEval = Infinity;
    for (const move of available) {
      const { nextState, success } = placeMark(state, move);
      if (!success) continue;

      const key = getStateKey(nextState);
      if (visited.has(key)) continue;

      visited.add(key);
      const evaluation = minimax(
        nextState,
        depth + 1,
        true,
        alpha,
        beta,
        maximizingPlayer,
        minimizingPlayer,
        visited,
        maxDepth
      );
      visited.delete(key);

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval === Infinity ? 0 : minEval;
  }
}

/**
 * Dispatches bot move calculation based on difficulty.
 */
export function getBotMove(
  state: GameState,
  difficulty: 'easy' | 'medium' | 'hard'
): number {
  switch (difficulty) {
    case 'easy':
      return getEasyBotMove(state);
    case 'medium':
      return getMediumBotMove(state);
    case 'hard':
      return getHardBotMove(state);
  }
}

/* =========================================================================
   MULTIPLAYER ONLINE ROOM LOGIC (Shared between client & PartyKit server)
   Authoritative pure functions with 2, 3, or 4 seats.
   ========================================================================= */


export function createInitialRoomSeats(seatsCount: 2 | 3 | 4, hostPlayerId?: string | null): PlayerSeat[] {
  const seats: PlayerSeat[] = [];
  for (let i = 0; i < seatsCount; i++) {
    const isHostSeat = i === 0 && Boolean(hostPlayerId);
    seats.push({
      seatIndex: i,
      symbol: MARK_SYMBOLS[i],
      playerId: isHostSeat ? (hostPlayerId as string) : null,
      isBot: false,
      isReady: isHostSeat,
      isConnected: isHostSeat,
      disconnectedAt: null,
    });
  }
  return seats;
}

export function createInitialRoomState(
  roomCode: string,
  hostPlayerId: string | null = null,
  seatsCount: 2 | 3 | 4 = 2
): RoomState {
  const seats = createInitialRoomSeats(seatsCount, hostPlayerId);
  const playerMoves: Record<MarkSymbol, number[]> = {
    X: [],
    O: [],
    '▲': [],
    '■': [],
  };

  return {
    roomCode,
    status: 'waiting',
    seatsCount,
    seats,
    hostPlayerId,
    board: Array(9).fill(null),
    playerMoves,
    turnSeatIndex: 0,
    turnStartedAt: Date.now(),
    turnDurationMs: 20000,
    startingSeatIndex: 0,
    winner: null,
    winningLine: null,
    lastVanished: null,
    spectatorCount: 0,
  };
}

export function getAvailableRoomMoves(state: RoomState): number[] {
  if (state.winner !== null) return [];
  const available: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (state.board[i] === null) {
      available.push(i);
    }
  }
  return available;
}

export function getNextVanishForSymbol(state: RoomState, symbol: MarkSymbol): number | null {
  const moves = state.playerMoves[symbol];
  if (moves && moves.length >= 3) {
    return moves[0];
  }
  return null;
}

export function getMarkAgeForSymbol(
  state: RoomState,
  cellIndex: number
): { symbol: MarkSymbol; ageIndex: 0 | 1 | 2; isOldestOfThree: boolean } | null {
  const mark = state.board[cellIndex];
  if (!mark) return null;

  const moves = state.playerMoves[mark];
  if (!moves) return null;

  const indexInQueue = moves.indexOf(cellIndex);
  if (indexInQueue === -1) return null;

  let ageIndex: 0 | 1 | 2 = 2;
  if (moves.length === 3) {
    ageIndex = indexInQueue as 0 | 1 | 2;
  } else if (moves.length === 2) {
    ageIndex = (indexInQueue + 1) as 1 | 2;
  } else {
    ageIndex = 2;
  }

  const isOldestOfThree = moves.length === 3 && indexInQueue === 0;
  return { symbol: mark, ageIndex, isOldestOfThree };
}

/**
 * Places a mark in a RoomState during authoritative multiplayer gameplay.
 * Enforces:
 * 1. Correct game status ('playing')
 * 2. Correct turn seat
 * 3. Legal, empty cell
 * 4. Vanishing mark removal BEFORE win check
 * 5. Win detection or turn rotation
 */
export function placeRoomMark(
  state: RoomState,
  seatIndex: number,
  cellIndex: number,
  timestamp: number = Date.now()
): { nextState: RoomState; success: boolean; error?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, success: false, error: 'Game is not in playing state' };
  }
  if (state.winner !== null) {
    return { nextState: state, success: false, error: 'Game is already over' };
  }
  if (state.turnSeatIndex !== seatIndex) {
    return { nextState: state, success: false, error: 'Not your turn' };
  }
  if (cellIndex < 0 || cellIndex > 8) {
    return { nextState: state, success: false, error: 'Invalid cell index' };
  }
  if (state.board[cellIndex] !== null) {
    return { nextState: state, success: false, error: 'Cell is already occupied' };
  }

  const currentSeat = state.seats[seatIndex];
  if (!currentSeat) {
    return { nextState: state, success: false, error: 'Invalid seat index' };
  }

  const symbol = currentSeat.symbol;
  const newBoard = [...state.board];
  const newPlayerMoves: Record<MarkSymbol, number[]> = {
    X: [...state.playerMoves.X],
    O: [...state.playerMoves.O],
    '▲': [...state.playerMoves['▲']],
    '■': [...state.playerMoves['■']],
  };

  let lastVanished: VanishedEvent | null = null;
  const movesForSymbol = newPlayerMoves[symbol];

  // 1. If symbol already has 3 marks, oldest vanishes FIRST
  if (movesForSymbol.length >= 3) {
    const oldestCell = movesForSymbol[0];
    newBoard[oldestCell] = null;
    newPlayerMoves[symbol] = movesForSymbol.slice(1);
    lastVanished = { symbol, cell: oldestCell };
  }

  // 2. Place new mark
  newBoard[cellIndex] = symbol;
  newPlayerMoves[symbol].push(cellIndex);

  // 3. Check win for symbol
  const winningLine = checkWin(newPlayerMoves[symbol]);
  const winner = winningLine ? symbol : null;
  const nextStatus = winner ? 'finished' : 'playing';

  // 4. Rotate turn to next seat if game continues
  const nextTurnSeatIndex = winner
    ? state.turnSeatIndex
    : (state.turnSeatIndex + 1) % state.seatsCount;

  const nextState: RoomState = {
    ...state,
    board: newBoard,
    playerMoves: newPlayerMoves,
    turnSeatIndex: nextTurnSeatIndex,
    turnStartedAt: timestamp,
    winner,
    winningLine,
    lastVanished,
    status: nextStatus,
  };

  return { nextState, success: true };
}

/**
 * Advances the turn to the next seat (e.g. after a turn timeout or disconnect auto-move).
 */
export function advanceRoomTurn(state: RoomState, timestamp: number = Date.now()): RoomState {
  if (state.status !== 'playing' || state.winner !== null) return state;
  const nextTurn = (state.turnSeatIndex + 1) % state.seatsCount;
  return {
    ...state,
    turnSeatIndex: nextTurn,
    turnStartedAt: timestamp,
  };
}

/**
 * Resets a room for rematch, rotating the starting seat.
 */
export function resetRoomForRematch(state: RoomState, timestamp: number = Date.now()): RoomState {
  const nextStartingSeat = (state.startingSeatIndex + 1) % state.seatsCount;
  return {
    ...state,
    board: Array(9).fill(null),
    playerMoves: {
      X: [],
      O: [],
      '▲': [],
      '■': [],
    },
    status: 'playing',
    turnSeatIndex: nextStartingSeat,
    startingSeatIndex: nextStartingSeat,
    turnStartedAt: timestamp,
    winner: null,
    winningLine: null,
    lastVanished: null,
  };
}

/**
 * Bot move calculation for a seat in a multiplayer room.
 * - Wins if possible (accounting for vanishing mark)
 * - Blocks any opponent threat
 * - Strategic center/corners/random fallback
 */
export function getRoomBotMove(state: RoomState, seatIndex: number): number {
  const available = getAvailableRoomMoves(state);
  if (available.length === 0) return -1;

  const botSymbol = state.seats[seatIndex].symbol;

  // 1. Can bot win on this move?
  for (const move of available) {
    const { nextState, success } = placeRoomMark(state, seatIndex, move);
    if (success && nextState.winner === botSymbol) {
      return move;
    }
  }

  // 2. Can any opponent win if we don't block?
  for (let s = 0; s < state.seatsCount; s++) {
    if (s === seatIndex) continue;
    const opponentSimState: RoomState = {
      ...state,
      turnSeatIndex: s,
    };
    for (const move of available) {
      const { nextState, success } = placeRoomMark(opponentSimState, s, move);
      if (success && nextState.winner === state.seats[s].symbol) {
        return move;
      }
    }
  }

  // 3. Prefer center
  if (available.includes(4)) return 4;

  // 4. Prefer corners
  const corners = [0, 2, 6, 8].filter((c) => available.includes(c));
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

