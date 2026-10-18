import { Server, Connection, ConnectionContext, WSMessage } from 'partyserver';
import {
  RoomState,
  ServerMessage,
  ClientMessageSchema,
  ClientMessage,
  MatchConfig,
  MarkSymbol,
  GameConfig,
} from '../src/lib/types';
import {
  createGame,
  createInitialRoomState,
  placeRoomMark,
  getLegalMoves,
  advanceRoomTurn,
  getRoomBotMove,
  resetRoomForRematch,
  createInitialRoomSeats,
  getConfigForPlayers,
  BOT_TIMING_CONFIG,
  getBotThinkingDelay,
} from '../src/lib/game';

export function createUninitializedRoomState(roomCode: string): RoomState {
  const baseGame = createGame(2);
  const playerMoves: Record<MarkSymbol, number[]> = {
    X: [],
    O: [],
    '▲': [],
    '■': [],
  };

  return {
    roomCode,
    status: 'uninitialized',
    phase: 'uninitialized',
    seatsCount: 2,
    config: baseGame.config,
    seats: [],
    hostPlayerId: null,
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

export interface Env {
  Main: DurableObjectNamespace<Main>;
  Lobby: DurableObjectNamespace<any>;
}

export interface ConnectionAdapter {
  id: string;
  send: (msg: string) => void;
  close?: () => void;
}

export class GameRoomHandler {
  public state: RoomState;
  public roomCode: string;
  private connections = new Map<string, ConnectionAdapter>();
  private connToPlayerId = new Map<string, string>();
  private messageTimestamps = new Map<string, number[]>();
  private joinCreateTimestamps = new Map<string, number[]>();
  private playerLastMessageTimestamps = new Map<string, number>();
  public lastActiveTimestamp: number;
  public gameOverTimestamp: number | null = null;
  public isExpired: boolean = false;
  public onScheduleAlarm?: (timestamp: number) => void;
  public onCancelAlarm?: () => void;
  public seatTokens = new Map<number, string>();
  public claimedSeatTokens = new Map<string, string>();
  public isMatchmade: boolean = false;

  constructor(roomCode: string, initialHostPlayerId: string | null = null, autoInitialize: boolean = false) {
    this.roomCode = roomCode;
    if (autoInitialize || initialHostPlayerId) {
      this.state = createInitialRoomState(roomCode, initialHostPlayerId, 2);
      this.state.hostPlayerId = initialHostPlayerId;
      this.state.phase = this.state.status;
    } else {
      this.state = createUninitializedRoomState(roomCode);
    }
    this.lastActiveTimestamp = Date.now();
    this.computeLobbyDerivedState();
  }

  public computeLobbyDerivedState() {
    this.state.phase = this.state.status;
    if (this.state.status === 'uninitialized') return;

    this.state.seatCount = this.state.seatsCount;
    this.state.requiredCount = this.state.seatsCount;

    // Normalize each seat with kind, ready, connected
    for (const seat of this.state.seats) {
      if (seat.isBot || seat.kind === 'bot') {
        seat.kind = 'bot';
        seat.isBot = true;
        seat.ready = true;
        seat.connected = true;
        seat.isReady = true;
        seat.isConnected = true;
      } else if (seat.playerId !== null) {
        seat.kind = 'human';
        const isConn = Boolean(seat.connected ?? seat.isConnected ?? true);
        seat.connected = isConn;
        seat.isConnected = isConn;
        // Host is always ready
        if (seat.playerId === this.state.hostPlayerId) {
          seat.isReady = true;
          seat.ready = true;
        } else {
          const isR = Boolean(seat.ready ?? seat.isReady);
          seat.ready = isR;
          seat.isReady = isR;
        }
      } else {
        seat.kind = 'empty';
        seat.isBot = false;
        seat.ready = false;
        seat.connected = false;
        seat.isReady = false;
        seat.isConnected = false;
      }
    }

    if (this.state.status !== 'waiting') {
      this.state.canStart = false;
      this.state.blockReasons = [];
      this.state.readyCount = this.state.seats.filter(
        (s) => s.isBot || (s.playerId && (s.isConnected || s.connected) && (s.isReady || s.ready))
      ).length;
      return;
    }

    const humanSeats = this.state.seats.filter((s) => s.kind === 'human' || (!s.isBot && s.playerId !== null));
    const botSeats = this.state.seats.filter((s) => s.kind === 'bot' || s.isBot);
    const filledCount = humanSeats.length + botSeats.length;

    const blockReasons: string[] = [];

    const totalSeats = this.state.seatCount ?? this.state.seatsCount ?? 2;
    // canStart is true only when:
    // 1. humans + bots equals seatCount
    // 2. at least 2 seats are filled
    if (filledCount < 2 || filledCount !== totalSeats) {
      blockReasons.push('SEATS_NOT_FILLED');
    }

    // 3. every human seat is ready (and connected)
    const allHumansReady =
      humanSeats.length > 0 &&
      humanSeats.every((s) => (s.connected !== false && s.isConnected !== false) && (s.ready || s.isReady));

    if (!allHumansReady) {
      blockReasons.push('NOT_ALL_READY');
    }

    this.state.canStart = blockReasons.length === 0;
    this.state.blockReasons = blockReasons;

    // readyCount: host is always ready, ready connected guests, and bots
    this.state.readyCount = this.state.seats.filter(
      (s) => s.kind === 'bot' || s.isBot || (!s.isBot && s.playerId !== null && (s.connected !== false && s.isConnected !== false) && (s.ready || s.isReady))
    ).length;
  }

  public broadcastState() {
    this.computeLobbyDerivedState();
    const msg: ServerMessage = { type: 'state', state: this.state };
    const numConns = this.connections.size;
    console.log(`[realtime:lobby] Broadcast state to ${numConns} connections for room ${this.roomCode}`);
    this.broadcast(msg);
  }

  public getConnectedCount(): number {
    let count = 0;
    for (const seat of this.state.seats) {
      if (seat.isConnected) count++;
    }
    return count + this.state.spectatorCount;
  }

  public getConnectedHumanCount(): number {
    let count = 0;
    for (const seat of this.state.seats) {
      if (!seat.isBot && seat.playerId !== null && seat.isConnected) count++;
    }
    return count;
  }

  public broadcast(msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const conn of this.connections.values()) {
      try {
        conn.send(json);
      } catch {
        // Connection send error catch
      }
    }
  }

  public sendTo(connId: string, msg: ServerMessage) {
    const conn = this.connections.get(connId);
    if (conn) {
      try {
        conn.send(JSON.stringify(msg));
      } catch {
        // Send error catch
      }
    }
  }

  public handleConnection(connId: string, sendFn: (msg: string) => void, closeFn?: () => void) {
    this.connections.set(connId, { id: connId, send: sendFn, close: closeFn });
    this.lastActiveTimestamp = Date.now();
    // Only send state if room is already initialized
    if (this.state.status !== 'uninitialized') {
      this.computeLobbyDerivedState();
      this.sendTo(connId, { type: 'state', state: this.state });
    }
  }

  public closeConnection(connId: string) {
    const conn = this.connections.get(connId);
    if (conn?.close) {
      try {
        conn.close();
      } catch {
        // Safe catch
      }
    }
    this.connections.delete(connId);
    this.connToPlayerId.delete(connId);
    this.messageTimestamps.delete(connId);
  }

  public handleDisconnection(connId: string, now: number = Date.now()) {
    const playerId = this.connToPlayerId.get(connId);
    this.connections.delete(connId);
    this.connToPlayerId.delete(connId);
    this.messageTimestamps.delete(connId);

    if (playerId) {
      // Find seat
      const seat = this.state.seats.find((s) => s.playerId === playerId);
      if (seat) {
        seat.isConnected = false;
        seat.connected = false;
        seat.disconnectedAt = now;
        // If a ready player disconnects in waiting room, mark them not ready (host stays ready)
        if (this.state.status === 'waiting' && seat.playerId !== this.state.hostPlayerId) {
          seat.isReady = false;
          seat.ready = false;
        }
        this.broadcast({ type: 'player_left', seatIndex: seat.seatIndex });

        // Note: A refresh or dropped connection must NOT change the host.
        // Transfer host only if host explicitly leaves or after 60s grace period.
        this.checkIfAllHumansLeft();
        if (this.onScheduleAlarm) {
          this.onScheduleAlarm(now + 60000);
        }
        this.broadcastState();
      }
    } else {
      // Was spectator
      if (this.state.spectatorCount > 0) {
        this.state.spectatorCount--;
        this.broadcastState();
      }
    }

    if (this.getConnectedHumanCount() === 0) {
      this.lastActiveTimestamp = now;
      this.cancelPendingBotMove();
    }
  }

  public handleMessage(connId: string, rawData: string, now: number = Date.now()): { success: boolean; error?: string; blockReasons?: string[] } {
    // 1. Rate Limiting: max 10 messages per second per connection
    const timestamps = this.messageTimestamps.get(connId) || [];
    const recent = timestamps.filter((t) => now - t < 1000);
    if (recent.length >= 10) {
      this.sendTo(connId, { type: 'error', code: 'RATE_LIMITED', message: 'Max 10 messages per second' });
      return { success: false, error: 'RATE_LIMITED' };
    }
    recent.push(now);
    this.messageTimestamps.set(connId, recent);
    this.lastActiveTimestamp = now;

    // Track last message timestamp for seat heartbeat
    const playerId = this.connToPlayerId.get(connId);
    if (playerId) {
      this.playerLastMessageTimestamps.set(playerId, now);
      // Restore connection if marked offline by inactivity
      const currentSeat = this.state.seats.find((s) => s.playerId === playerId);
      if (currentSeat && !currentSeat.isConnected && !currentSeat.isBot) {
        currentSeat.isConnected = true;
        currentSeat.disconnectedAt = null;
        this.broadcast({ type: 'state', state: this.state });
      }
    }

    // 2. Parse & Zod Validation
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawData);
    } catch {
      this.sendTo(connId, { type: 'error', code: 'INVALID_JSON' });
      return { success: false, error: 'INVALID_JSON' };
    }

    const parseResult = ClientMessageSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      this.sendTo(connId, { type: 'error', code: 'INVALID_SCHEMA', message: 'Message format invalid' });
      return { success: false, error: 'INVALID_SCHEMA' };
    }

    const message: ClientMessage = parseResult.data;
    console.log(`[realtime:handler] Room ${this.roomCode} message ${message.type} from conn ${connId} (player: ${this.connToPlayerId.get(connId) || 'unknown'})`);

    // 3. Security: Rate-limit create and join attempts per connection (max 5 per 10 seconds)
    if (message.type === 'create' || message.type === 'join') {
      const attempts = this.joinCreateTimestamps.get(connId) || [];
      const recentAttempts = attempts.filter((t) => now - t < 10000);
      if (recentAttempts.length >= 5) {
        this.sendTo(connId, { type: 'error', code: 'RATE_LIMITED', message: 'Max 5 attempts per 10 seconds' });
        this.closeConnection(connId);
        return { success: false, error: 'RATE_LIMITED' };
      }
      recentAttempts.push(now);
      this.joinCreateTimestamps.set(connId, recentAttempts);
    }

    // 4. Room State Machine (server-side)
    // A room starts as "uninitialized" with no host, no players, no game.
    if (this.state.status === 'uninitialized') {
      if (message.type === 'create') {
        return this.handleCreate(connId, message.playerId, message.seatsCount, message.matchToken, message.matchConfig);
      } else {
        // If "join" (or any other message) is sent to an uninitialized room, reply with ROOM_NOT_FOUND, then close connection
        this.sendTo(connId, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        this.closeConnection(connId);
        this.isExpired = true;
        return { success: false, error: 'ROOM_NOT_FOUND' };
      }
    }

    // If "create" is sent to a room that is already initialized, reply with error code ROOM_TAKEN and change nothing
    if (message.type === 'create') {
      this.sendTo(connId, { type: 'error', code: 'ROOM_TAKEN', message: 'Room already created' });
      return { success: false, error: 'ROOM_TAKEN' };
    }

    return this.processIntent(connId, message, now);
  }

  private processIntent(connId: string, msg: ClientMessage, now: number): { success: boolean; error?: string } {
    switch (msg.type) {
      case 'create':
        return this.handleCreate(connId, msg.playerId, msg.seatsCount, msg.matchToken, msg.matchConfig);
      case 'join':
        return this.handleJoin(connId, msg.playerId, msg.matchConfig, msg.matchToken, now);
      case 'set_seats':
        return this.handleSetSeats(connId, msg.seatsCount);
      case 'set_bot_seat':
        return this.handleSetBotSeat(connId, msg.seatIndex, msg.isBot);
      case 'ready':
        return this.handleReady(connId, msg.ready);
      case 'start':
        return this.handleStart(connId, now);
      case 'place':
        return this.handlePlace(connId, msg.cell, now);
      case 'rematch':
        return this.handleRematch(connId, now);
      case 'leave':
        return this.handleLeave(connId, now);
      case 'ping':
        return { success: true };
    }
  }

  public initMatch(
    matchToken: string,
    seatsCount: 2 | 3 | 4,
    startingSeatIndex: number,
    botSeats: number[],
    seatTokens?: Record<number, string>,
    config?: GameConfig
  ): { success: boolean; error?: string } {
    if (this.state.status !== 'uninitialized') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[realtime:dev] Create: room=${this.roomCode}, result=ROOM_TAKEN`);
      }
      return { success: false, error: 'ROOM_TAKEN' };
    }

    const gameConfig = config || getConfigForPlayers(seatsCount);
    this.state = createInitialRoomState(this.roomCode, null, seatsCount);
    this.state.config = gameConfig;
    this.state.board = Array(gameConfig.totalCells).fill(null);
    this.state.status = 'waiting';
    this.state.phase = 'waiting';
    this.state.matchToken = matchToken;
    this.state.startingSeatIndex = startingSeatIndex;
    this.state.turnSeatIndex = startingSeatIndex;
    this.state.hostPlayerId = null;
    this.isMatchmade = true;

    this.seatTokens.clear();
    this.claimedSeatTokens.clear();
    if (seatTokens) {
      for (const [seatStr, tok] of Object.entries(seatTokens)) {
        this.seatTokens.set(parseInt(seatStr, 10), tok);
      }
    }

    for (const botIdx of botSeats) {
      if (this.state.seats[botIdx]) {
        this.state.seats[botIdx].isBot = true;
        this.state.seats[botIdx].kind = 'bot';
        this.state.seats[botIdx].isReady = true;
        this.state.seats[botIdx].ready = true;
        this.state.seats[botIdx].isConnected = true;
        this.state.seats[botIdx].connected = true;
      }
    }

    this.computeLobbyDerivedState();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[realtime:dev] Create: room=${this.roomCode}, result=SUCCESS, seats=${seatsCount}`);
    }

    return { success: true };
  }

  private handleCreate(
    connId: string,
    playerId: string,
    seatsCount: 2 | 3 | 4 = 2,
    matchToken?: string,
    matchConfig?: MatchConfig
  ): { success: boolean; error?: string } {
    if (this.state.status !== 'uninitialized') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[realtime:dev] Create: room=${this.roomCode}, result=ROOM_TAKEN`);
      }
      this.sendTo(connId, { type: 'error', code: 'ROOM_TAKEN' });
      return { success: false, error: 'ROOM_TAKEN' };
    }

    const now = Date.now();
    this.connToPlayerId.set(connId, playerId);
    this.playerLastMessageTimestamps.set(playerId, now);
    const chosenSeats = matchConfig ? matchConfig.seatsCount : (seatsCount || 2);
    this.state = createInitialRoomState(this.roomCode, playerId, chosenSeats);
    this.state.status = 'waiting';
    this.state.phase = 'waiting';
    this.state.hostPlayerId = playerId;
    this.state.seatCount = chosenSeats;
    this.state.seatsCount = chosenSeats;

    if (this.state.seats[0]) {
      this.state.seats[0].playerId = playerId;
      this.state.seats[0].joinedAt = now;
      this.state.seats[0].isConnected = true;
      this.state.seats[0].connected = true;
      this.state.seats[0].isReady = true;
      this.state.seats[0].ready = true;
      this.state.seats[0].kind = 'human';
    }

    if (matchToken) {
      this.state.matchToken = matchToken;
    }

    if (matchConfig) {
      this.state.startingSeatIndex = matchConfig.startingSeatIndex;
      this.state.turnSeatIndex = matchConfig.startingSeatIndex;
      for (const botIdx of matchConfig.botSeats) {
        if (this.state.seats[botIdx]) {
          this.state.seats[botIdx].isBot = true;
          this.state.seats[botIdx].kind = 'bot';
          this.state.seats[botIdx].isReady = true;
          this.state.seats[botIdx].ready = true;
          this.state.seats[botIdx].isConnected = true;
          this.state.seats[botIdx].connected = true;
        }
      }
      if (matchConfig.assignedSeatIndex > 0 && this.state.seats[0]) {
        this.state.seats[0].playerId = null;
        this.state.seats[0].kind = 'empty';
        this.state.seats[0].isConnected = false;
        this.state.seats[0].connected = false;
        this.state.seats[0].isReady = false;
        this.state.seats[0].ready = false;
        const target = this.state.seats[matchConfig.assignedSeatIndex];
        if (target) {
          target.playerId = playerId;
          target.kind = 'human';
          target.joinedAt = now;
          target.isConnected = true;
          target.connected = true;
          target.isReady = true;
          target.ready = true;
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[realtime:dev] Create: room=${this.roomCode}, player=${playerId}, result=SUCCESS, seats=${chosenSeats}`);
    }

    this.computeLobbyDerivedState();
    this.sendTo(connId, { type: 'state', state: this.state });
    this.broadcast({ type: 'player_joined', seatIndex: matchConfig?.assignedSeatIndex ?? 0, isBot: false });
    this.broadcastState();
    return { success: true };
  }

  private handleJoin(
    connId: string,
    playerId: string,
    matchConfig?: MatchConfig,
    matchToken?: string,
    now: number = Date.now()
  ): { success: boolean; error?: string } {
    this.connToPlayerId.set(connId, playerId);
    this.playerLastMessageTimestamps.set(playerId, now);

    // 1. Reconnect existing player or duplicate join (Idempotent: same playerId keeps the seat)
    const existingSeat = this.state.seats.find((s) => s.playerId === playerId);
    if (existingSeat) {
      existingSeat.isConnected = true;
      existingSeat.connected = true;
      existingSeat.disconnectedAt = null;

      // Host reconnecting keeps host role and is always ready
      if (this.state.hostPlayerId === playerId) {
        existingSeat.isReady = true;
        existingSeat.ready = true;
      }

      // If host was null, restore host
      if (!this.state.hostPlayerId) {
        this.state.hostPlayerId = playerId;
        existingSeat.isReady = true;
        existingSeat.ready = true;
      }

      // Check if all humans are reconnected -> cancel 60s grace alarm
      const hasDisconnected = this.state.seats.some((s) => !s.isBot && s.playerId !== null && !s.isConnected);
      if (!hasDisconnected && this.onCancelAlarm) {
        this.onCancelAlarm();
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=RECONNECT_SUCCESS, seat=${existingSeat.seatIndex}`);
      }

      this.computeLobbyDerivedState();
      this.sendTo(connId, { type: 'state', state: this.state });
      this.broadcast({ type: 'player_joined', seatIndex: existingSeat.seatIndex, isBot: false });
      this.broadcastState();
      return { success: true };
    }

    // 2. Matchmaking seat assignment via token
    // If room is matchmade, require and validate per-seat token
    const isMatchRoom = this.isMatchmade || this.seatTokens.size > 0 || Boolean(this.state.matchToken);
    if (isMatchRoom) {
      let assignedSeatIdx = -1;

      if (this.seatTokens.size > 0 && matchToken) {
        for (const [seatIdx, token] of this.seatTokens.entries()) {
          if (token === matchToken) {
            assignedSeatIdx = seatIdx;
            break;
          }
        }
      } else if (this.state.matchToken && matchToken === this.state.matchToken) {
        assignedSeatIdx = matchConfig?.assignedSeatIndex ?? 0;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[realtime:dev] Token check: room=${this.roomCode}, player=${playerId}, token=${matchToken || 'none'}, result=${assignedSeatIdx !== -1 ? 'VALID' : 'INVALID'}, seat=${assignedSeatIdx}`
        );
      }

      if (assignedSeatIdx === -1) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=INVALID_TOKEN`);
        }
        this.sendTo(connId, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Invalid or missing match token' });
        this.closeConnection(connId);
        return { success: false, error: 'ROOM_NOT_FOUND' };
      }

      const targetSeat = this.state.seats[assignedSeatIdx];
      if (!targetSeat || targetSeat.isBot) {
        this.sendTo(connId, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Seat not available' });
        this.closeConnection(connId);
        return { success: false, error: 'ROOM_NOT_FOUND' };
      }

      // Check if claimed by another player
      const claimedPlayer = matchToken ? this.claimedSeatTokens.get(matchToken) : undefined;
      if (claimedPlayer && claimedPlayer !== playerId && targetSeat.playerId && targetSeat.playerId !== playerId && targetSeat.isConnected) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=TOKEN_ALREADY_CLAIMED`);
        }
        this.sendTo(connId, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Token already claimed' });
        this.closeConnection(connId);
        return { success: false, error: 'ROOM_NOT_FOUND' };
      }

      // Assign seat from the token!
      if (matchToken) {
        this.claimedSeatTokens.set(matchToken, playerId);
      }
      targetSeat.playerId = playerId;
      targetSeat.kind = 'human';
      targetSeat.joinedAt = now;
      targetSeat.isConnected = true;
      targetSeat.connected = true;
      targetSeat.isReady = true;
      targetSeat.ready = true;
      targetSeat.disconnectedAt = null;

      if (!this.state.hostPlayerId) {
        this.state.hostPlayerId = playerId;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=MATCH_SUCCESS, seat=${assignedSeatIdx}`);
      }

      this.broadcast({ type: 'player_joined', seatIndex: targetSeat.seatIndex, isBot: false });

      // Auto-start if all humans in this match are present
      const allHumansPresent = this.state.seats.every((s) => s.isBot || (s.playerId !== null && s.isConnected));
      if (allHumansPresent && this.state.status === 'waiting') {
        this.state.status = 'playing';
        this.state.phase = 'playing';
        this.state.turnStartedAt = now;
        this.computeLobbyDerivedState();
        this.sendTo(connId, { type: 'state', state: this.state });
        this.broadcastState();
        this.scheduleNextBotMove(now);
        return { success: true };
      }

      this.computeLobbyDerivedState();
      this.sendTo(connId, { type: 'state', state: this.state });
      this.broadcastState();
      return { success: true };
    }

    // 3. Room waiting: join as regular player if empty seat exists
    const emptySeat = this.state.seats.find((s) => s.playerId === null && !s.isBot);

    if (emptySeat && this.state.status === 'waiting') {
      emptySeat.playerId = playerId;
      emptySeat.kind = 'human';
      emptySeat.joinedAt = now;
      emptySeat.isConnected = true;
      emptySeat.connected = true;
      emptySeat.disconnectedAt = null;

      if (!this.state.hostPlayerId) {
        this.state.hostPlayerId = playerId;
        emptySeat.isReady = true;
        emptySeat.ready = true;
      } else {
        emptySeat.isReady = false;
        emptySeat.ready = false;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=PRIVATE_SUCCESS, seat=${emptySeat.seatIndex}`);
      }

      this.broadcast({ type: 'player_joined', seatIndex: emptySeat.seatIndex, isBot: false });
      this.computeLobbyDerivedState();
      this.sendTo(connId, { type: 'state', state: this.state });
      this.broadcastState();
      return { success: true };
    }

    // 4. Otherwise spectator
    this.state.spectatorCount++;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[realtime:dev] Join: room=${this.roomCode}, player=${playerId}, result=SPECTATOR`);
    }
    this.computeLobbyDerivedState();
    this.sendTo(connId, { type: 'state', state: this.state });
    this.broadcastState();
    return { success: true };
  }

  private handleSetSeats(connId: string, seatsCount: 2 | 3 | 4): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    if (this.state.status !== 'waiting' || this.state.hostPlayerId !== playerId) {
      this.sendTo(connId, { type: 'error', code: 'UNAUTHORIZED', message: 'Only host can change seats in waiting room' });
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (seatsCount === this.state.seatsCount) {
      this.broadcastState();
      return { success: true };
    }

    const oldSeats = this.state.seats;
    const newSeats = createInitialRoomSeats(seatsCount, this.state.hostPlayerId || undefined);

    // Copy existing seat states into new seats
    for (let i = 0; i < seatsCount; i++) {
      if (i < oldSeats.length) {
        newSeats[i] = { ...oldSeats[i] };
      }
    }

    // Any ousted players from shrank seats count become spectators
    for (let i = seatsCount; i < oldSeats.length; i++) {
      if (oldSeats[i].playerId && !oldSeats[i].isBot) {
        this.state.spectatorCount++;
      }
    }

    // Rebuild game config and board using createGame(seatsCount) BEFORE game starts
    const newGame = createGame(seatsCount);
    this.state.seatsCount = seatsCount;
    this.state.seatCount = seatsCount;
    this.state.config = newGame.config;
    this.state.board = newGame.board as (MarkSymbol | null)[];

    // Reset guest ready states on seat count change; host and bots stay ready
    // Rebuild empty seats with clean state
    for (let i = 0; i < newSeats.length; i++) {
      const s = newSeats[i];
      if (s.isBot) {
        s.kind = 'bot';
        s.isReady = true;
        s.ready = true;
        s.isConnected = true;
        s.connected = true;
      } else if (s.playerId === this.state.hostPlayerId) {
        s.kind = 'human';
        s.isReady = true;
        s.ready = true;
      } else if (s.playerId !== null) {
        s.kind = 'human';
        s.isReady = false;
        s.ready = false;
      } else {
        // Rebuilt empty seat
        s.kind = 'empty';
        s.playerId = null;
        s.isBot = false;
        s.isReady = false;
        s.ready = false;
        s.isConnected = false;
        s.connected = false;
        s.disconnectedAt = null;
        s.joinedAt = null;
      }
    }

    this.state.seats = newSeats;
    this.broadcastState();
    return { success: true };
  }

  private handleSetBotSeat(connId: string, seatIndex: number, isBot: boolean): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    if (this.state.status !== 'waiting' || this.state.hostPlayerId !== playerId) {
      this.sendTo(connId, { type: 'error', code: 'UNAUTHORIZED' });
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (seatIndex === 0) {
      this.sendTo(connId, { type: 'error', code: 'CANNOT_BOT_HOST' });
      return { success: false, error: 'CANNOT_BOT_HOST' };
    }

    const seat = this.state.seats[seatIndex];
    if (!seat) return { success: false, error: 'INVALID_SEAT' };

    seat.isBot = isBot;
    if (isBot) {
      seat.playerId = null;
      seat.kind = 'bot';
      seat.isReady = true;
      seat.ready = true;
      seat.isConnected = true;
      seat.connected = true;
      seat.disconnectedAt = null;
      seat.joinedAt = null;
    } else {
      seat.playerId = null;
      seat.kind = 'empty';
      seat.isReady = false;
      seat.ready = false;
      seat.isConnected = false;
      seat.connected = false;
      seat.disconnectedAt = null;
      seat.joinedAt = null;
    }

    this.broadcastState();
    return { success: true };
  }

  private handleReady(connId: string, ready: boolean): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    const seat = this.state.seats.find((s) => s.playerId === playerId);
    if (!seat) return { success: false, error: 'NOT_SEATED' };

    // Host is automatically ready
    if (this.state.hostPlayerId === playerId) {
      seat.isReady = true;
      seat.ready = true;
      this.broadcastState();
      return { success: true };
    }

    seat.isReady = ready;
    seat.ready = ready;
    this.broadcastState();
    return { success: true };
  }

  private handleStart(connId: string, now: number): { success: boolean; error?: string; blockReasons?: string[] } {
    const playerId = this.connToPlayerId.get(connId);
    if (!this.state.hostPlayerId || this.state.hostPlayerId !== playerId) {
      const blockReasons = ['NOT_HOST'];
      this.sendTo(connId, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Only the host can start the game',
        blockReasons,
      });
      return { success: false, error: 'UNAUTHORIZED', blockReasons };
    }
    if (this.state.status !== 'waiting') {
      return { success: false, error: 'ALREADY_STARTED' };
    }

    this.computeLobbyDerivedState();

    if (!this.state.canStart) {
      const primaryReason = this.state.blockReasons?.[0] || 'CANNOT_START';
      const msg = primaryReason === 'NOT_ALL_READY' ? 'All players must be ready' : 'All seats must be filled';
      this.sendTo(connId, {
        type: 'error',
        code: primaryReason,
        message: msg,
        blockReasons: this.state.blockReasons,
      });
      return { success: false, error: primaryReason, blockReasons: this.state.blockReasons };
    }

    const seatCount = (this.state.seatCount ?? this.state.seatsCount ?? 2) as 2 | 3 | 4;
    const config = getConfigForPlayers(seatCount);
    this.state.config = config;
    this.state.board = Array(config.totalCells).fill(null);
    this.state.playerMoves = {
      X: [],
      O: [],
      '▲': [],
      '■': [],
    };
    this.state.status = 'playing';
    this.state.phase = 'playing';
    this.state.turnSeatIndex = 0;
    this.state.startingSeatIndex = 0;
    this.state.turnStartedAt = now;
    this.state.winner = null;
    this.state.winningLine = null;
    this.state.lastVanished = null;
    this.state.history = [];
    this.state.lastMoveCell = null;
    this.gameOverTimestamp = null;
    this.cancelPendingBotMove();
    this.broadcastState();

    // If starting player is bot, schedule bot move
    if (this.state.seats[this.state.turnSeatIndex]?.isBot) {
      this.scheduleNextBotMove(now);
    }

    return { success: true };
  }

  private handlePlace(connId: string, cell: number, now: number): { success: boolean; error?: string } {
    if (this.state.status !== 'playing') {
      this.sendTo(connId, { type: 'error', code: 'NOT_PLAYING' });
      return { success: false, error: 'NOT_PLAYING' };
    }

    const playerId = this.connToPlayerId.get(connId);
    const seat = this.state.seats.find((s) => s.playerId === playerId);
    if (!seat) {
      this.sendTo(connId, { type: 'error', code: 'NOT_IN_GAME' });
      return { success: false, error: 'NOT_IN_GAME' };
    }

    if (seat.seatIndex !== this.state.turnSeatIndex) {
      this.sendTo(connId, { type: 'error', code: 'NOT_YOUR_TURN' });
      return { success: false, error: 'NOT_YOUR_TURN' };
    }

    const { nextState, success, error } = placeRoomMark(this.state, seat.seatIndex, cell, now);
    if (!success) {
      this.sendTo(connId, { type: 'error', code: 'ILLEGAL_MOVE', message: error });
      return { success: false, error: error || 'ILLEGAL_MOVE' };
    }

    this.state = nextState;
    if (this.state.status === 'finished') {
      this.gameOverTimestamp = now;
      this.cancelPendingBotMove();
    } else {
      const nextSeat = this.state.seats[this.state.turnSeatIndex];
      if (nextSeat && !nextSeat.isBot) {
        this.state.turnStartedAt = now;
      }
    }
    this.broadcastState();

    // Check if next turn is bot
    if (this.state.status === 'playing' && this.state.winner === null) {
      this.scheduleNextBotMove(now);
    }

    return { success: true };
  }

  private handleRematch(connId: string, now: number): { success: boolean; error?: string } {
    if (this.state.status !== 'finished') {
      return { success: false, error: 'GAME_NOT_FINISHED' };
    }

    // After game ends, rematch includes remaining players, filling empty seats with bots
    for (const seat of this.state.seats) {
      if (seat.playerId === null && !seat.isBot) {
        seat.isBot = true;
        seat.kind = 'bot';
        seat.isReady = true;
        seat.ready = true;
        seat.isConnected = true;
        seat.connected = true;
      }
    }

    this.cancelPendingBotMove();
    this.state = resetRoomForRematch(this.state, now);
    this.gameOverTimestamp = null;
    this.broadcastState();

    if (this.state.seats[this.state.turnSeatIndex]?.isBot) {
      this.scheduleNextBotMove(now);
    }
    return { success: true };
  }

  private handleLeave(connId: string, now: number): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    this.connections.delete(connId);
    this.connToPlayerId.delete(connId);
    this.messageTimestamps.delete(connId);

    if (playerId) {
      const seat = this.state.seats.find((s) => s.playerId === playerId);
      if (seat) {
        this.broadcast({ type: 'player_left', seatIndex: seat.seatIndex });

        const isLeavingHost = this.state.hostPlayerId === playerId;

        if (this.state.status === 'playing') {
          // Mid-game leave: seat taken over by bot immediately
          seat.isBot = true;
          seat.kind = 'bot';
          seat.playerId = null;
          seat.isConnected = true;
          seat.connected = true;
          seat.isReady = true;
          seat.ready = true;
          seat.disconnectedAt = null;

          if (isLeavingHost) {
            this.transferHostLongestPresent(now);
          }

          if (this.state.turnSeatIndex === seat.seatIndex) {
            this.scheduleNextBotMove(now);
          }
        } else {
          // Waiting or Finished: deliberate leave frees the seat immediately
          seat.playerId = null;
          seat.kind = 'empty';
          seat.isConnected = false;
          seat.connected = false;
          seat.isReady = false;
          seat.ready = false;
          seat.disconnectedAt = null;
          seat.joinedAt = null;

          if (isLeavingHost) {
            this.transferHostLongestPresent(now);
          }
        }

        this.checkIfAllHumansLeft();
        this.broadcastState();
      }
    } else {
      if (this.state.spectatorCount > 0) {
        this.state.spectatorCount--;
        this.broadcastState();
      }
    }

    if (this.getConnectedHumanCount() === 0) {
      this.lastActiveTimestamp = now;
      this.cancelPendingBotMove();
    }

    return { success: true };
  }

  public transferHostIfNeeded(): string | null {
    const currentHostSeat = this.state.seats.find((s) => s.playerId === this.state.hostPlayerId && s.isConnected);
    if (currentHostSeat) {
      return this.state.hostPlayerId;
    }

    return this.transferHostLongestPresent();
  }

  public transferHostLongestPresent(now: number = Date.now()): string | null {
    const oldHostId = this.state.hostPlayerId;
    const candidates = this.state.seats.filter(
      (s) => !s.isBot && s.playerId !== null && s.isConnected && s.playerId !== oldHostId
    );

    if (candidates.length === 0) {
      this.state.hostPlayerId = null;
      return null;
    }

    // Pick the longest-present connected human:
    // Sort by joinedAt ascending (lowest timestamp = joined earliest). If tied or missing, seatIndex.
    candidates.sort((a, b) => {
      const aTime = a.joinedAt ?? 0;
      const bTime = b.joinedAt ?? 0;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return a.seatIndex - b.seatIndex;
    });

    const newHost = candidates[0];
    this.state.hostPlayerId = newHost.playerId;
    newHost.isReady = true;
    newHost.ready = true;

    if (newHost.playerId) {
      this.broadcast({
        type: 'host_changed',
        newHostPlayerId: newHost.playerId,
        seatIndex: newHost.seatIndex,
      });
    }

    return newHost.playerId;
  }

  public checkIfAllHumansLeft(): boolean {
    const hasHuman = this.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    return !hasHuman;
  }

  /**
   * Automatically executes a move for the specified seat.
   * Safety rule: if no legal move exists for any reason, auto-skips turn and broadcasts state.
   */
  public autoPlayMove(seatIndex: number, now: number = Date.now()): boolean {
    if (this.state.status !== 'playing' || this.state.turnSeatIndex !== seatIndex) return false;

    this.cancelPendingBotMove();

    const available = getLegalMoves(this.state);
    if (available.length === 0) {
      this.state = advanceRoomTurn(this.state, now);
      if (this.state.status === 'finished') {
        this.gameOverTimestamp = now;
        this.cancelPendingBotMove();
      }
      this.broadcastState();
      this.scheduleNextBotMove(now);
      return true;
    }

    // Use smart bot move or fallback to random
    let move = getRoomBotMove(this.state, seatIndex);
    if (move === -1 || !available.includes(move)) {
      move = available[Math.floor(Math.random() * available.length)];
    }

    const { nextState, success } = placeRoomMark(this.state, seatIndex, move, now);
    if (success) {
      this.state = nextState;
      if (this.state.status === 'finished') {
        this.gameOverTimestamp = now;
        this.cancelPendingBotMove();
      } else {
        const nextSeat = this.state.seats[this.state.turnSeatIndex];
        if (nextSeat && !nextSeat.isBot) {
          this.state.turnStartedAt = now;
        }
      }
      this.broadcastState();
      if (this.state.status === 'playing' && this.state.winner === null) {
        this.scheduleNextBotMove(now);
      }
      return true;
    }
    return false;
  }

  private botTimer: ReturnType<typeof setTimeout> | null = null;
  public scheduledBotSeat: number | null = null;
  public scheduledBotTime: number | null = null;

  public cancelPendingBotMove() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.scheduledBotSeat = null;
    this.scheduledBotTime = null;
  }

  public scheduleNextBotMove(now: number = Date.now()) {
    if (this.state.status !== 'playing' || this.state.winner !== null) {
      this.cancelPendingBotMove();
      return;
    }

    const hasConnectedHuman = this.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    if (!hasConnectedHuman) {
      this.cancelPendingBotMove();
      return;
    }

    const currentSeat = this.state.seats[this.state.turnSeatIndex];
    if (!currentSeat || !currentSeat.isBot) {
      this.cancelPendingBotMove();
      return;
    }

    // At most one bot move can be scheduled at a time
    if (this.botTimer && this.scheduledBotSeat === currentSeat.seatIndex) {
      return;
    }

    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    // Safety rule: if current player has no legal move for any reason, auto-skip their turn immediately
    const available = getLegalMoves(this.state);
    if (available.length === 0) {
      this.state = advanceRoomTurn(this.state, now);
      if (this.state.status === 'finished') {
        this.gameOverTimestamp = now;
        this.cancelPendingBotMove();
      }
      this.broadcastState();
      this.scheduleNextBotMove(now);
      return;
    }

    const isFirstMove = (this.state.history?.length ?? 0) === 0;
    const thinkingDelay = getBotThinkingDelay('medium', { isFirstMove });
    const totalDelay = BOT_TIMING_CONFIG.animationDuration + thinkingDelay;

    this.scheduledBotSeat = currentSeat.seatIndex;
    this.scheduledBotTime = now + totalDelay;

    this.botTimer = setTimeout(() => {
      const execTime = this.scheduledBotTime || Date.now();
      this.botTimer = null;
      this.scheduledBotSeat = null;
      this.scheduledBotTime = null;
      if (
        this.state.status === 'playing' &&
        this.state.winner === null &&
        this.state.turnSeatIndex === currentSeat.seatIndex
      ) {
        this.autoPlayMove(currentSeat.seatIndex, execTime);
      }
    }, totalDelay);

    if (this.onScheduleAlarm) {
      this.onScheduleAlarm(now + totalDelay);
    }
  }

  /**
   * Periodic server tick (called every 1s or on demand):
   * 1. 2-minute post game-over room expiration
   * 2. 5-minute empty room (no connected humans) expiration
   * 3. 60s without heartbeat/message -> marks seat offline
   * 4. 60s grace period for disconnected seats:
   *    - In waiting: frees seat, and if was host, transfers host to longest-present connected human
   *    - In playing: converts seat to bot, transfers host if needed
   * 5. 20s offline disconnect during turn -> auto move
   * 6. 20s turn expiration -> auto move
   */
  public tick(now: number = Date.now()) {
    // 1. Post-game 2-minute expiration check (if nobody taps Again or Home within 2 minutes)
    if (this.state.status === 'finished' && this.gameOverTimestamp) {
      if (now - this.gameOverTimestamp >= 2 * 60 * 1000) {
        this.isExpired = true;
        return;
      }
    }

    // 2. 5-minute empty room expiration check (no connected humans)
    const hasConnectedHuman = this.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    if (!hasConnectedHuman && now - this.lastActiveTimestamp >= 5 * 60 * 1000) {
      this.isExpired = true;
      return;
    }

    // 3. Check 60s inactivity for connected seated humans (heartbeat check)
    let stateChanged = false;
    for (const seat of this.state.seats) {
      if (!seat.isBot && seat.playerId !== null && seat.isConnected) {
        const lastMsg = this.playerLastMessageTimestamps.get(seat.playerId) ?? this.lastActiveTimestamp;
        if (now - lastMsg >= 60000) {
          seat.isConnected = false;
          seat.connected = false;
          seat.disconnectedAt = now;
          if (this.state.status === 'waiting') {
            seat.isReady = false;
            seat.ready = false;
          }
          this.broadcast({ type: 'player_left', seatIndex: seat.seatIndex });
          stateChanged = true;
        }
      }
    }

    // 4. Check 60s grace period for disconnected seats
    for (const seat of this.state.seats) {
      if (!seat.isBot && seat.playerId !== null && !seat.isConnected && seat.disconnectedAt) {
        const offlineDuration = now - seat.disconnectedAt;

        // 60s offline: grace period expired!
        if (offlineDuration >= 60000) {
          stateChanged = true;
          const isLeavingHost = seat.playerId === this.state.hostPlayerId;

          if (this.state.status === 'waiting') {
            // Free the seat
            seat.playerId = null;
            seat.kind = 'empty';
            seat.isConnected = false;
            seat.connected = false;
            seat.isReady = false;
            seat.ready = false;
            seat.disconnectedAt = null;
            seat.joinedAt = null;

            if (isLeavingHost) {
              this.transferHostLongestPresent(now);
            }
          } else if (this.state.status === 'playing') {
            // In game: bot permanently takes over seat
            seat.isBot = true;
            seat.kind = 'bot';
            seat.playerId = null;
            seat.isConnected = true;
            seat.connected = true;
            seat.isReady = true;
            seat.ready = true;
            seat.disconnectedAt = null;
            seat.joinedAt = null;

            if (isLeavingHost) {
              this.transferHostLongestPresent(now);
            }
          }
        } else if (this.state.status === 'playing' && seat.seatIndex === this.state.turnSeatIndex && offlineDuration >= 20000) {
          // 20s offline during their turn: auto-play move
          this.autoPlayMove(seat.seatIndex, now);
          return;
        }
      }
    }

    if (stateChanged) {
      this.broadcastState();
    }

    if (this.state.status !== 'playing') return;

    const currentSeat = this.state.seats[this.state.turnSeatIndex];
    if (!currentSeat) return;

    // 5. Bot move if turn is on a bot - NEVER move several bots in the same tick!
    // The scheduler handles delays between moves. If un-scheduled, ensure it's scheduled.
    if (currentSeat.isBot) {
      this.scheduleNextBotMove(now);
      return;
    }

    // 6. Check turn timer timeout (20s) for connected human player
    const turnElapsed = now - this.state.turnStartedAt;
    if (turnElapsed >= this.state.turnDurationMs) {
      this.autoPlayMove(currentSeat.seatIndex, now);
      return;
    }
  }
}

/**
 * Main game room Durable Object server (PartyServer on Cloudflare Workers)
 * URL: /parties/main/<ROOMCODE>
 */
export class Main extends Server<Env> {
  static options = { hibernate: false };

  public handler: GameRoomHandler;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private createdAt = Date.now();
  private messageCount = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.handler = new GameRoomHandler(this.name);
    this.handler.onScheduleAlarm = (timestamp) => {
      this.scheduleAlarm(timestamp);
    };
    this.handler.onCancelAlarm = () => {
      this.cancelAlarm();
    };
    this.startTimers();
  }

  private devLog(msg: string, extra?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      const activeSeconds = Math.floor((Date.now() - this.createdAt) / 1000);
      console.log(`[realtime:main:${this.name}] (${activeSeconds}s active, msgs: ${this.messageCount}) ${msg}`, extra ?? '');
    }
  }

  get state(): RoomState {
    return this.handler.state;
  }

  get roomCode(): string {
    return this.name;
  }

  get isExpired(): boolean {
    return this.handler.isExpired;
  }

  private startTimers() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      this.tick(Date.now());
    }, 1000);
  }

  public tick(now: number = Date.now()) {
    this.handler.tick(now);
    if (this.handler.isExpired) {
      this.cleanupRoom();
    }
  }

  public async scheduleAlarm(timestamp: number) {
    try {
      if (this.ctx.storage?.setAlarm) {
        const existing = await this.ctx.storage.getAlarm();
        if (!existing || timestamp < existing) {
          await this.ctx.storage.setAlarm(timestamp);
        }
      }
    } catch {
      // Storage alarm safe catch
    }
  }

  public async cancelAlarm() {
    try {
      if (this.ctx.storage?.deleteAlarm) {
        await this.ctx.storage.deleteAlarm();
      }
    } catch {
      // Storage alarm safe catch
    }
  }

  async onAlarm() {
    const now = Date.now();
    this.devLog('Alarm fired', { now });
    this.tick(now);

    // Game over 2-minute expiration
    if (this.handler.state.status === 'finished' && this.handler.gameOverTimestamp) {
      if (now - this.handler.gameOverTimestamp >= 120000) {
        this.handler.isExpired = true;
        this.cleanupRoom();
        return;
      }
    }

    // 5-minute empty room expiration
    const hasHuman = this.handler.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    if (!hasHuman && now - this.handler.lastActiveTimestamp >= 300000) {
      this.handler.isExpired = true;
      this.cleanupRoom();
      return;
    }
  }

  public cleanupRoom() {
    this.devLog('Room expired, cleaning up');
    this.handler.cancelPendingBotMove();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const conn of this.getConnections()) {
      try {
        conn.close(1000, 'Room expired');
      } catch {
        // Safe catch
      }
    }
    try {
      this.ctx.storage?.deleteAll();
    } catch {
      // Safe catch
    }
  }

  onConnect(conn: Connection, _ctx?: ConnectionContext) {
    this.messageCount++;
    this.devLog(`Client connected: ${conn.id}`);
    this.startTimers();

    this.handler.handleConnection(
      conn.id,
      (msg: string) => {
        try {
          conn.send(msg);
        } catch {
          // Safe catch
        }
      },
      () => {
        try {
          conn.close();
        } catch {
          // Safe catch
        }
      }
    );
  }

  onMessage(a: any, b: any) {
    this.messageCount++;
    let conn: Connection;
    let message: WSMessage;

    if (typeof a === 'string' || a instanceof ArrayBuffer || ArrayBuffer.isView(a)) {
      message = a;
      conn = b;
    } else {
      conn = a;
      message = b;
    }

    if (typeof message === 'string') {
      console.log(`[realtime:server] Received message from conn ${conn?.id}: ${message}`);
      this.devLog(`Message from ${conn?.id}: ${message}`);
      this.handler.handleMessage(conn?.id ?? '', message, Date.now());

      // If finished, schedule 2-minute alarm
      if (this.handler.state.status === 'finished' && this.handler.gameOverTimestamp) {
        this.scheduleAlarm(this.handler.gameOverTimestamp + 120000);
      } else if (this.handler.state.status === 'playing') {
        this.scheduleAlarm(this.handler.state.turnStartedAt + this.handler.state.turnDurationMs);
      }
    }
  }

  onClose(conn: Connection) {
    this.devLog(`Client disconnected: ${conn.id}`);
    this.handler.handleDisconnection(conn.id, Date.now());
    const hasHuman = this.handler.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    if (!hasHuman) {
      this.scheduleAlarm(Date.now() + 300000);
    }
  }

  onError(conn: Connection) {
    this.devLog(`Client error: ${conn.id}`);
    this.handler.handleDisconnection(conn.id, Date.now());
    const hasHuman = this.handler.state.seats.some((s) => !s.isBot && s.playerId !== null && s.isConnected);
    if (!hasHuman) {
      this.scheduleAlarm(Date.now() + 300000);
    }
  }

  async onRequest(req: Request): Promise<Response> {
    if (req.method === 'POST') {
      try {
        const body = (await req.json()) as {
          type?: string;
          matchToken?: string;
          seatTokens?: Record<number, string>;
          seatsCount?: 2 | 3 | 4;
          startingSeatIndex?: number;
          botSeats?: number[];
          config?: GameConfig;
        };
        if (body.type === 'create_match' && body.seatsCount !== undefined) {
          const res = this.handler.initMatch(
            body.matchToken || '',
            body.seatsCount,
            body.startingSeatIndex ?? 0,
            body.botSeats ?? [],
            body.seatTokens,
            body.config
          );
          if (!res.success) {
            return new Response(JSON.stringify({ error: res.error }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: 'INVALID_REQUEST' }), { status: 400 });
      }
    }
    return new Response('Not Found', { status: 404 });
  }
}

export default Main;
