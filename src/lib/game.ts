import {
  GameConfig,
  MarkSymbol,
  MARK_SYMBOLS,
  MoveRecord,
  PlayerSeat,
  RoomState,
  VanishedEvent,
} from './types';

export type Player = 'X' | 'O';

export function getConfigForPlayers(playerCount: number): GameConfig {
  const count = Math.max(2, Math.min(4, Math.round(playerCount)));
  let gridSize = 3;
  if (count === 3) {
    gridSize = 5;
  } else if (count === 4) {
    gridSize = 6;
  }

  return {
    playerCount: count,
    gridSize,
    totalCells: gridSize * gridSize,
    marksPerPlayer: 3,
    winStreak: 3,
  };
}

const WINNING_LINES_CACHE = new Map<number, [number, number, number][]>();

/**
 * Generates all winning lines of streak length (default 3) for a given gridSize.
 */
export function getWinningLines(gridSize: number = 3, streak: number = 3): [number, number, number][] {
  const cacheKey = gridSize * 100 + streak;
  const cached = WINNING_LINES_CACHE.get(cacheKey);
  if (cached) return cached;

  const lines: [number, number, number][] = [];
  const N = gridSize;
  const K = streak;

  // 1. Horizontal
  for (let r = 0; r < N; r++) {
    for (let c = 0; c <= N - K; c++) {
      lines.push([r * N + c, r * N + c + 1, r * N + c + 2]);
    }
  }

  // 2. Vertical
  for (let c = 0; c < N; c++) {
    for (let r = 0; r <= N - K; r++) {
      lines.push([r * N + c, (r + 1) * N + c, (r + 2) * N + c]);
    }
  }

  // 3. Diagonal (top-left to bottom-right)
  for (let r = 0; r <= N - K; r++) {
    for (let c = 0; c <= N - K; c++) {
      lines.push([r * N + c, (r + 1) * N + (c + 1), (r + 2) * N + (c + 2)]);
    }
  }

  // 4. Anti-diagonal (top-right to bottom-left)
  for (let r = 0; r <= N - K; r++) {
    for (let c = K - 1; c < N; c++) {
      lines.push([r * N + c, (r + 1) * N + (c - 1), (r + 2) * N + (c - 2)]);
    }
  }

  WINNING_LINES_CACHE.set(cacheKey, lines);
  return lines;
}

export const WINNING_LINES = getWinningLines(3, 3);

export interface VanishedInfo {
  player: Player;
  cell: number;
}

export interface GameState {
  config: GameConfig;
  board: (Player | null)[];
  movesX: number[]; // oldest at index 0, newest at end (max 3)
  movesO: number[]; // oldest at index 0, newest at end (max 3)
  turn: Player;
  winner: Player | null;
  winningLine: [number, number, number] | null;
  lastVanished: VanishedInfo | null;
  moveCount: number;
  history: MoveRecord[];
  lastMoveCell: number | null;
}

/**
 * Creates a new GameState according to the provided config or player count.
 * Safety validation: boardCells must be strictly greater than players * marksPerPlayer.
 * In development, throws an Error if invalid.
 * In production, falls back to the correct config for the player count.
 */
export function createGame(configOrPlayers: GameConfig | number = 2): GameState {
  let config: GameConfig;
  if (typeof configOrPlayers === 'number') {
    config = getConfigForPlayers(configOrPlayers);
  } else {
    config = { ...configOrPlayers };
  }

  const minRequiredCells = config.playerCount * config.marksPerPlayer;
  if (config.totalCells <= minRequiredCells) {
    const errorMsg = `Invalid game config: boardCells (${config.totalCells}) must be strictly greater than players * marksPerPlayer (${minRequiredCells})`;
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(errorMsg);
    } else {
      config = getConfigForPlayers(config.playerCount);
    }
  }

  return {
    config,
    board: Array(config.totalCells).fill(null),
    movesX: [],
    movesO: [],
    turn: 'X',
    winner: null,
    winningLine: null,
    lastVanished: null,
    moveCount: 0,
    history: [],
    lastMoveCell: null,
  };
}

export function createInitialState(startingPlayer: Player = 'X', configInput: GameConfig | number = 2): GameState {
  const state = createGame(configInput);
  state.turn = startingPlayer;
  return state;
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
export function checkWin(moves: number[], gridSize: number = 3): [number, number, number] | null {
  if (moves.length < 3) return null;
  const moveSet = new Set(moves);
  const lines = getWinningLines(gridSize, 3);
  for (const line of lines) {
    if (moveSet.has(line[0]) && moveSet.has(line[1]) && moveSet.has(line[2])) {
      return line;
    }
  }
  return null;
}

/**
 * Pure function to get winner info from a player's moves list.
 */
export function getWinner(moves: number[], gridSize: number = 3): { winner: boolean; line: [number, number, number] | null } {
  const line = checkWin(moves, gridSize);
  return { winner: line !== null, line };
}

/**
 * Returns list of legal cell moves for the current player.
 * Safety rule:
 * - If board has empty cells, return all empty cells.
 * - If the board has NO empty cells, the current player's oldest mark is removed first
 *   (vanish happens BEFORE placement), and that freed cell becomes the only legal move.
 */
export function getLegalMoves(state: GameState | RoomState): number[] {
  if ('winner' in state && state.winner !== null) return [];
  if ('status' in state && state.status === 'finished') return [];

  // 1. Check empty cells on board
  const emptyCells: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) {
      emptyCells.push(i);
    }
  }

  if (emptyCells.length > 0) {
    return emptyCells;
  }

  // 2. Full board: current player's oldest mark is removed first,
  // and that freed cell becomes the only legal move.
  if ('movesX' in state) {
    // GameState
    const moves = state.turn === 'X' ? state.movesX : state.movesO;
    if (moves.length > 0) {
      return [moves[0]];
    }
    return [];
  } else {
    // RoomState
    const currentSeat = state.seats[state.turnSeatIndex];
    if (!currentSeat) return [];
    const moves = state.playerMoves[currentSeat.symbol] || [];
    if (moves.length > 0) {
      return [moves[0]];
    }
    return [];
  }
}

/**
 * Returns list of empty cell indices on the board (alias for getLegalMoves).
 */
export function getAvailableMoves(state: GameState): number[] {
  return getLegalMoves(state);
}

/**
 * Places a mark for the current turn player.
 * Rule:
 * 1. Validate move (game active, cell in bounds).
 * 2. If the current player has 3 marks (or board has no empty cells and player has marks),
 *    remove the OLDEST mark FIRST (vanish happens BEFORE placement).
 * 3. Validate cell is empty after vanish.
 * 4. Add the new mark to the board and to the player's queue.
 * 5. Check for a win AFTER removal and placement.
 * 6. Switch turn if game is not won.
 */
export function placeMark(
  state: GameState,
  cellIndex: number
): { nextState: GameState; success: boolean; error?: string } {
  if (state.winner !== null) {
    return { nextState: state, success: false, error: 'Game is already over' };
  }
  if (cellIndex < 0 || cellIndex >= state.board.length) {
    return { nextState: state, success: false, error: 'Invalid cell index' };
  }

  const currentPlayer = state.turn;
  const newBoard = [...state.board];
  let newMovesX = [...state.movesX];
  let newMovesO = [...state.movesO];
  let lastVanished: VanishedInfo | null = null;

  const isBoardFull = !newBoard.some((c) => c === null);

  // Vanish happens BEFORE placement
  if (currentPlayer === 'X') {
    if (newMovesX.length >= 3 || (isBoardFull && newMovesX.length > 0)) {
      const oldestCell = newMovesX[0];
      newBoard[oldestCell] = null;
      newMovesX = newMovesX.slice(1);
      lastVanished = { player: 'X', cell: oldestCell };
    }
  } else {
    if (newMovesO.length >= 3 || (isBoardFull && newMovesO.length > 0)) {
      const oldestCell = newMovesO[0];
      newBoard[oldestCell] = null;
      newMovesO = newMovesO.slice(1);
      lastVanished = { player: 'O', cell: oldestCell };
    }
  }

  // Check if cell is occupied after vanish
  if (newBoard[cellIndex] !== null) {
    return { nextState: state, success: false, error: 'Cell is already occupied' };
  }

  // Place new mark
  if (currentPlayer === 'X') {
    newBoard[cellIndex] = 'X';
    newMovesX.push(cellIndex);
  } else {
    newBoard[cellIndex] = 'O';
    newMovesO.push(cellIndex);
  }

  // Check win for the player who just moved
  const gridSize = state.config?.gridSize || Math.round(Math.sqrt(state.board.length));
  const movesToCheck = currentPlayer === 'X' ? newMovesX : newMovesO;
  const winningLine = checkWin(movesToCheck, gridSize);
  const winner = winningLine ? currentPlayer : null;
  const nextTurn = winner ? currentPlayer : (currentPlayer === 'X' ? 'O' : 'X');

  const moveRecord: MoveRecord = {
    player: currentPlayer,
    cell: cellIndex,
    vanished: lastVanished ? { symbol: lastVanished.player, cell: lastVanished.cell } : null,
  };
  const newHistory = [...(state.history || []), moveRecord];

  const nextState: GameState = {
    config: state.config || getConfigForPlayers(2),
    board: newBoard,
    movesX: newMovesX,
    movesO: newMovesO,
    turn: nextTurn,
    winner,
    winningLine,
    lastVanished,
    moveCount: state.moveCount + 1,
    history: newHistory,
    lastMoveCell: cellIndex,
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
 * 2. One-move lookahead: filters out any move where the opponent has an immediate
 *    winning reply on their next turn (avoids walking into vanish traps and missed blocks).
 * 3. Blocks any current opponent threat.
 * 4. Positional fallback: center (4), corners, then random.
 *
 * Difficulty behavior: Medium avoids immediate 1-move traps, but lacks multi-ply
 * minimax depth, making it beatable by players who set up forks or 2+ move strategies.
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

  // 2. Avoid walking into immediate defeat: filter for safe moves where opponent
  // cannot immediately win on their next turn (including vanish trap positions).
  const safeMoves = available.filter((move) => {
    const { nextState, success } = placeMark(state, move);
    if (!success) return false;
    const oppMoves = getAvailableMoves(nextState);
    return !oppMoves.some((oppMove) => {
      const oppRes = placeMark(nextState, oppMove);
      return oppRes.success && oppRes.nextState.winner === opponentPlayer;
    });
  });

  const candidatePool = safeMoves.length > 0 ? safeMoves : available;

  // 3. Can opponent win on their next turn if we don't block?
  // We simulate opponent playing as current turn
  const opponentSimState: GameState = {
    ...state,
    turn: opponentPlayer,
  };
  const winningBlocks: number[] = [];
  for (const move of candidatePool) {
    const { nextState, success } = placeMark(opponentSimState, move);
    if (success && nextState.winner === opponentPlayer) {
      winningBlocks.push(move);
    }
  }
  if (winningBlocks.length > 0) {
    return winningBlocks[0];
  }

  // 4. Strategic fallback: prefer center (4) if available
  if (candidatePool.includes(4)) return 4;

  // Prefer corners
  const corners = [0, 2, 6, 8].filter((c) => candidatePool.includes(c));
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // Otherwise random available from candidatePool
  return candidatePool[Math.floor(Math.random() * candidatePool.length)];
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

  const minOldest = minMoves.length === 3 ? minMoves[0] : -1;
  const maxOldest = maxMoves.length === 3 ? maxMoves[0] : -1;

  for (const [a, b, c] of WINNING_LINES) {
    const cells = [a, b, c];
    const maxCount = cells.filter((cell) => maxSet.has(cell)).length;
    const minCount = cells.filter((cell) => minSet.has(cell)).length;

    if (maxCount === 2 && minCount === 0) score += 40;
    if (minCount === 2 && maxCount === 0) score -= 50;

    // Vanish trap threat: maximizing player sets up 2-in-a-row targeting opponent's vanishing mark
    if (minOldest !== -1 && cells.includes(minOldest) && maxCount === 2) {
      score += 70;
    }
    // Vanish trap danger: minimizing player threatens line where 3rd cell is maximizing player's vanishing mark
    if (maxOldest !== -1 && cells.includes(maxOldest) && minCount === 2) {
      score -= 80;
    }
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
  const baseGame = createGame(seatsCount);
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
    config: baseGame.config,
    seats,
    hostPlayerId,
    board: baseGame.board as (MarkSymbol | null)[],
    playerMoves,
    turnSeatIndex: 0,
    turnStartedAt: Date.now(),
    turnDurationMs: 20000,
    startingSeatIndex: 0,
    winner: null,
    winningLine: null,
    lastVanished: null,
    spectatorCount: 0,
    history: [],
    lastMoveCell: null,
  };
}

export function getAvailableRoomMoves(state: RoomState): number[] {
  return getLegalMoves(state);
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
 * 3. Legal cell index (within state.board.length)
 * 4. Vanishing mark removal BEFORE win check (and before placement)
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
  if (cellIndex < 0 || cellIndex >= state.board.length) {
    return { nextState: state, success: false, error: 'Invalid cell index' };
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
  let movesForSymbol = newPlayerMoves[symbol];
  const isBoardFull = !newBoard.some((c) => c === null);

  // 1. If symbol already has 3 marks (or board has no empty cells and player has marks), oldest vanishes FIRST
  if (movesForSymbol.length >= 3 || (isBoardFull && movesForSymbol.length > 0)) {
    const oldestCell = movesForSymbol[0];
    newBoard[oldestCell] = null;
    movesForSymbol = movesForSymbol.slice(1);
    newPlayerMoves[symbol] = movesForSymbol;
    lastVanished = { symbol, cell: oldestCell };
  }

  // 2. Validate cell is empty after vanish
  if (newBoard[cellIndex] !== null) {
    return { nextState: state, success: false, error: 'Cell is already occupied' };
  }

  // 3. Place new mark
  newBoard[cellIndex] = symbol;
  newPlayerMoves[symbol].push(cellIndex);

  // 4. Check win for symbol
  const gridSize = state.config?.gridSize || getConfigForPlayers(state.seatsCount).gridSize;
  const winningLine = checkWin(newPlayerMoves[symbol], gridSize);
  const winner = winningLine ? symbol : null;
  const nextStatus = winner ? 'finished' : 'playing';

  // 5. Rotate turn to next seat if game continues
  const nextTurnSeatIndex = winner
    ? state.turnSeatIndex
    : (state.turnSeatIndex + 1) % state.seatsCount;

  const moveRecord: MoveRecord = {
    player: symbol,
    cell: cellIndex,
    vanished: lastVanished,
  };
  const newHistory = [...(state.history || []), moveRecord];

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
    history: newHistory,
    lastMoveCell: cellIndex,
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
  const newGame = createGame(state.config || state.seatsCount);
  return {
    ...state,
    config: newGame.config,
    board: newGame.board as (MarkSymbol | null)[],
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
    history: [],
    lastMoveCell: null,
  };
}

/**
 * Bot move calculation for a seat in a multiplayer room.
 * - Wins if possible (accounting for vanishing mark)
 * - Blocks any opponent threat
 * - Strategic center/corners/random fallback
 */
export function getRoomBotMove(state: RoomState, seatIndex: number): number {
  const available = getLegalMoves(state);
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

  // 3. Strategic fallback: prefer center
  const gridSize = state.config?.gridSize || getConfigForPlayers(state.seatsCount).gridSize;
  const mid = Math.floor(gridSize / 2);
  const centerCell = mid * gridSize + mid;
  if (available.includes(centerCell)) return centerCell;

  // Prefer corners
  const corners = [0, gridSize - 1, (gridSize - 1) * gridSize, gridSize * gridSize - 1].filter((c) =>
    available.includes(c)
  );
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/* =========================================================================
   REPLAY & MOVE INSIGHTS (Pure functions for game-over analysis)
   ========================================================================= */

export interface MoveInsight {
  stepIndex: number;
  hasWarning: boolean;
  isTrap: boolean;
  reason?: 'opponent_win_available' | 'none';
}

/**
 * Pure function to evaluate insights / traps for each move in game history.
 * Flags moves where the opponent had an immediate winning reply available after the move.
 */
export function getMoveInsights(
  history: MoveRecord[],
  config: GameConfig = getConfigForPlayers(2)
): MoveInsight[] {
  if (!history || history.length === 0) return [];

  const gridSize = config.gridSize;
  const totalCells = config.totalCells;

  const board: (MarkSymbol | null)[] = Array(totalCells).fill(null);
  const playerMarks: Record<MarkSymbol, number[]> = {
    X: [],
    O: [],
    '▲': [],
    '■': [],
  };

  const insights: MoveInsight[] = [];

  for (let i = 0; i < history.length; i++) {
    const move = history[i];

    // Apply vanish for this move if any
    if (move.vanished) {
      board[move.vanished.cell] = null;
      playerMarks[move.vanished.symbol] = playerMarks[move.vanished.symbol].filter(
        (c) => c !== move.vanished!.cell
      );
    }

    // Apply placement
    board[move.cell] = move.player;
    playerMarks[move.player].push(move.cell);

    // Check if the current move itself won the game
    const currentMoves = playerMarks[move.player];
    const isWin = checkWin(currentMoves, gridSize) !== null;

    if (isWin) {
      insights.push({
        stepIndex: i,
        hasWarning: false,
        isTrap: false,
        reason: 'none',
      });
      continue;
    }

    // Next opponent to move
    let opponent: MarkSymbol = move.player === 'X' ? 'O' : 'X';
    if (config.playerCount > 2) {
      const activeSymbols = MARK_SYMBOLS.slice(0, config.playerCount);
      const curIdx = activeSymbols.indexOf(move.player);
      opponent = activeSymbols[(curIdx + 1) % config.playerCount];
    }

    // Check if opponent has an immediate winning reply available
    const oppMarks = playerMarks[opponent] || [];
    let oppSimMarks = [...oppMarks];
    const oppSimBoard = [...board];

    // If opponent already has maximum marks, oldest vanishes before placement
    if (oppSimMarks.length >= (config.marksPerPlayer || 3)) {
      const oldestOppMark = oppSimMarks[0];
      oppSimBoard[oldestOppMark] = null;
      oppSimMarks = oppSimMarks.slice(1);
    }

    // Check all empty cells on oppSimBoard
    let opponentCanWin = false;
    for (let c = 0; c < totalCells; c++) {
      if (oppSimBoard[c] === null) {
        const candidateMarks = [...oppSimMarks, c];
        if (checkWin(candidateMarks, gridSize) !== null) {
          opponentCanWin = true;
          break;
        }
      }
    }

    insights.push({
      stepIndex: i,
      hasWarning: opponentCanWin,
      isTrap: opponentCanWin,
      reason: opponentCanWin ? 'opponent_win_available' : 'none',
    });
  }

  return insights;
}

export interface BoardStepState {
  board: (MarkSymbol | null)[];
  playerMoves: Record<MarkSymbol, number[]>;
  lastMove: MoveRecord;
  winner: MarkSymbol | null;
  winningLine: [number, number, number] | null;
}

/**
 * Reconstructs board and player moves at a specific step in history (0-indexed).
 */
export function getBoardAtMove(
  history: MoveRecord[],
  targetStep: number,
  configOrGridSize: GameConfig | number = 3
): BoardStepState | null {
  if (!history || history.length === 0 || targetStep < 0 || targetStep >= history.length) {
    return null;
  }

  const gridSize = typeof configOrGridSize === 'number' ? configOrGridSize : configOrGridSize.gridSize;
  const totalCells = gridSize * gridSize;
  const board: (MarkSymbol | null)[] = Array(totalCells).fill(null);
  const playerMoves: Record<MarkSymbol, number[]> = {
    X: [],
    O: [],
    '▲': [],
    '■': [],
  };

  for (let i = 0; i <= targetStep; i++) {
    const move = history[i];
    if (move.vanished) {
      board[move.vanished.cell] = null;
      playerMoves[move.vanished.symbol] = playerMoves[move.vanished.symbol].filter(
        (c) => c !== move.vanished!.cell
      );
    }
    board[move.cell] = move.player;
    playerMoves[move.player].push(move.cell);
  }

  const currentMove = history[targetStep];
  const winningLine = checkWin(playerMoves[currentMove.player], gridSize);
  const winner = winningLine ? currentMove.player : null;

  return {
    board,
    playerMoves,
    lastMove: currentMove,
    winner,
    winningLine,
  };
}

