import {
  RoomState,
  ServerMessage,
  ClientMessageSchema,
  ClientMessage,
} from '../src/lib/types';
import {
  createInitialRoomState,
  placeRoomMark,
  getAvailableRoomMoves,
  getRoomBotMove,
  resetRoomForRematch,
  createInitialRoomSeats,
} from '../src/lib/game';

export interface ConnectionAdapter {
  id: string;
  send: (msg: string) => void;
}

export class GameRoomHandler {
  public state: RoomState;
  public roomCode: string;
  private connections = new Map<string, ConnectionAdapter>();
  private connToPlayerId = new Map<string, string>();
  private messageTimestamps = new Map<string, number[]>();
  public lastActiveTimestamp: number;
  public isExpired: boolean = false;

  constructor(roomCode: string, initialHostPlayerId: string | null = null) {
    this.roomCode = roomCode;
    this.state = createInitialRoomState(roomCode, initialHostPlayerId, 2);
    this.lastActiveTimestamp = Date.now();
  }

  public getConnectedCount(): number {
    let count = 0;
    for (const seat of this.state.seats) {
      if (seat.isConnected) count++;
    }
    return count + this.state.spectatorCount;
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

  public handleConnection(connId: string, sendFn: (msg: string) => void) {
    this.connections.set(connId, { id: connId, send: sendFn });
    this.lastActiveTimestamp = Date.now();
    // Send initial state to the connected client
    this.sendTo(connId, { type: 'state', state: this.state });
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
        seat.disconnectedAt = now;
        this.broadcast({ type: 'player_left', seatIndex: seat.seatIndex });
        this.broadcast({ type: 'state', state: this.state });
      }
    } else {
      // Was spectator
      if (this.state.spectatorCount > 0) {
        this.state.spectatorCount--;
        this.broadcast({ type: 'state', state: this.state });
      }
    }

    if (this.getConnectedCount() === 0) {
      this.lastActiveTimestamp = now;
    }
  }

  public handleMessage(connId: string, rawData: string, now: number = Date.now()): { success: boolean; error?: string } {
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
    return this.processIntent(connId, message, now);
  }

  private processIntent(connId: string, msg: ClientMessage, now: number): { success: boolean; error?: string } {
    switch (msg.type) {
      case 'join':
        return this.handleJoin(connId, msg.playerId);
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
    }
  }

  private handleJoin(connId: string, playerId: string): { success: boolean; error?: string } {
    this.connToPlayerId.set(connId, playerId);

    // 1. Reconnect existing player
    const existingSeat = this.state.seats.find((s) => s.playerId === playerId);
    if (existingSeat) {
      existingSeat.isConnected = true;
      existingSeat.disconnectedAt = null;

      // If host was null, restore host
      if (!this.state.hostPlayerId) {
        this.state.hostPlayerId = playerId;
      }

      this.broadcast({ type: 'player_joined', seatIndex: existingSeat.seatIndex, isBot: false });
      this.broadcast({ type: 'state', state: this.state });
      return { success: true };
    }

    // 2. Room already playing or finished: join as spectator if no empty seats
    const emptySeat = this.state.seats.find((s) => s.playerId === null && !s.isBot);

    if (emptySeat && this.state.status === 'waiting') {
      emptySeat.playerId = playerId;
      emptySeat.isConnected = true;
      emptySeat.isReady = emptySeat.seatIndex === 0; // Host ready by default
      emptySeat.disconnectedAt = null;

      if (!this.state.hostPlayerId || this.state.seats[0].playerId === playerId) {
        this.state.hostPlayerId = playerId;
      }

      this.broadcast({ type: 'player_joined', seatIndex: emptySeat.seatIndex, isBot: false });
      this.broadcast({ type: 'state', state: this.state });
      return { success: true };
    }

    // 3. Otherwise spectator
    this.state.spectatorCount++;
    this.broadcast({ type: 'state', state: this.state });
    return { success: true };
  }

  private handleSetSeats(connId: string, seatsCount: 2 | 3 | 4): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    if (this.state.status !== 'waiting' || this.state.hostPlayerId !== playerId) {
      this.sendTo(connId, { type: 'error', code: 'UNAUTHORIZED', message: 'Only host can change seats in waiting room' });
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (seatsCount === this.state.seatsCount) return { success: true };

    const oldSeats = this.state.seats;
    const newSeats = createInitialRoomSeats(seatsCount, this.state.hostPlayerId || undefined);

    // Copy existing seat states into new seats
    for (let i = 0; i < seatsCount; i++) {
      if (i < oldSeats.length) {
        newSeats[i] = { ...oldSeats[i] };
      }
    }

    this.state.seatsCount = seatsCount;
    this.state.seats = newSeats;
    this.broadcast({ type: 'state', state: this.state });
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
      seat.isReady = true;
      seat.isConnected = true;
      seat.disconnectedAt = null;
    } else {
      seat.playerId = null;
      seat.isReady = false;
      seat.isConnected = false;
    }

    this.broadcast({ type: 'state', state: this.state });
    return { success: true };
  }

  private handleReady(connId: string, ready: boolean): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    const seat = this.state.seats.find((s) => s.playerId === playerId);
    if (!seat) return { success: false, error: 'NOT_SEATED' };

    seat.isReady = ready;
    this.broadcast({ type: 'state', state: this.state });
    return { success: true };
  }

  private handleStart(connId: string, now: number): { success: boolean; error?: string } {
    const playerId = this.connToPlayerId.get(connId);
    if (this.state.hostPlayerId !== playerId) {
      this.sendTo(connId, { type: 'error', code: 'UNAUTHORIZED' });
      return { success: false, error: 'UNAUTHORIZED' };
    }
    if (this.state.status !== 'waiting') {
      return { success: false, error: 'ALREADY_STARTED' };
    }

    // Verify all seats are filled (human or bot) and humans are ready
    const allFilledAndReady = this.state.seats.every((s) => {
      if (s.isBot) return true;
      return s.playerId !== null && s.isReady;
    });

    if (!allFilledAndReady) {
      this.sendTo(connId, { type: 'error', code: 'NOT_ALL_READY', message: 'All players must be ready' });
      return { success: false, error: 'NOT_ALL_READY' };
    }

    this.state.status = 'playing';
    this.state.turnSeatIndex = 0;
    this.state.startingSeatIndex = 0;
    this.state.turnStartedAt = now;
    this.broadcast({ type: 'state', state: this.state });

    // If starting player is bot, trigger bot move immediately
    this.checkAndTriggerBotMove(now);

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
    this.broadcast({ type: 'state', state: this.state });

    // Check if next turn is bot
    this.checkAndTriggerBotMove(now);

    return { success: true };
  }

  private handleRematch(connId: string, now: number): { success: boolean; error?: string } {
    if (this.state.status !== 'finished') {
      return { success: false, error: 'GAME_NOT_FINISHED' };
    }

    this.state = resetRoomForRematch(this.state, now);
    this.broadcast({ type: 'state', state: this.state });

    this.checkAndTriggerBotMove(now);
    return { success: true };
  }

  private handleLeave(connId: string, now: number): { success: boolean; error?: string } {
    this.handleDisconnection(connId, now);
    return { success: true };
  }

  /**
   * Automatically executes a move for the specified seat.
   */
  public autoPlayMove(seatIndex: number, now: number = Date.now()): boolean {
    if (this.state.status !== 'playing' || this.state.turnSeatIndex !== seatIndex) return false;

    const available = getAvailableRoomMoves(this.state);
    if (available.length === 0) return false;

    // Use smart bot move or fallback to random
    let move = getRoomBotMove(this.state, seatIndex);
    if (move === -1 || !available.includes(move)) {
      move = available[Math.floor(Math.random() * available.length)];
    }

    const { nextState, success } = placeRoomMark(this.state, seatIndex, move, now);
    if (success) {
      this.state = nextState;
      this.broadcast({ type: 'state', state: this.state });
      this.checkAndTriggerBotMove(now);
      return true;
    }
    return false;
  }

  private checkAndTriggerBotMove(now: number) {
    if (this.state.status !== 'playing') return;
    const currentSeat = this.state.seats[this.state.turnSeatIndex];
    if (currentSeat && currentSeat.isBot) {
      // Execute bot move
      this.autoPlayMove(currentSeat.seatIndex, now);
    }
  }

  /**
   * Periodic server tick (called every 1s or on demand):
   * 1. 20s turn expiration -> auto move
   * 2. 20s offline disconnect during turn -> auto move
   * 3. 60s offline disconnect -> convert seat to bot
   * 4. 10min empty room -> mark expired
   */
  public tick(now: number = Date.now()) {
    // 10 minute empty room expiration check
    if (this.getConnectedCount() === 0 && now - this.lastActiveTimestamp >= 10 * 60 * 1000) {
      this.isExpired = true;
      return;
    }

    if (this.state.status !== 'playing') return;

    const currentSeat = this.state.seats[this.state.turnSeatIndex];
    if (!currentSeat) return;

    // 1. Check offline disconnected seats first (60s -> convert to bot, 20s during turn -> auto-move)
    for (const seat of this.state.seats) {
      if (!seat.isBot && !seat.isConnected && seat.disconnectedAt) {
        const offlineDuration = now - seat.disconnectedAt;

        // 60s offline: Bot permanently takes over seat
        if (offlineDuration >= 60000) {
          seat.isBot = true;
          seat.isConnected = true;
          this.broadcast({ type: 'state', state: this.state });
          continue;
        }

        // 20s offline during their turn: auto-play move
        if (seat.seatIndex === this.state.turnSeatIndex && offlineDuration >= 20000) {
          this.autoPlayMove(seat.seatIndex, now);
          return;
        }
      }
    }

    // 2. Bot move if turn is on a bot
    if (currentSeat.isBot) {
      this.autoPlayMove(currentSeat.seatIndex, now);
      return;
    }

    // 3. Check turn timer timeout (20s)
    const turnElapsed = now - this.state.turnStartedAt;
    if (turnElapsed >= this.state.turnDurationMs) {
      this.autoPlayMove(currentSeat.seatIndex, now);
      return;
    }
  }
}
