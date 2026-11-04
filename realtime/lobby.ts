import { Server, Connection, ConnectionContext, WSMessage } from 'partyserver';
import {
  LobbyClientMessageSchema,
  LobbyClientMessage,
  LobbyServerMessage,
  generateRoomCode,
  generateMatchToken,
} from '../src/lib/types';
import { Main } from './room';

import { getConfigForPlayers } from '../src/lib/game';
import { GameConfig } from '../src/lib/types';

export interface Env {
  Main: DurableObjectNamespace<Main>;
  Lobby: DurableObjectNamespace<Lobby>;
}

export interface QueuePlayer {
  playerId: string;
  connId: string;
  joinedAt: number;
  send: (msg: string) => void;
}

export interface MatchCreateConfig {
  seatsCount: 2 | 3 | 4;
  startingSeatIndex: number;
  botSeats: number[];
  seatTokens: Record<number, string>;
  config: GameConfig;
}

export type MatchRoomCreator = (
  roomCode: string,
  matchToken: string,
  config: MatchCreateConfig
) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };

export class LobbyHandler {
  public queues: Record<2 | 3 | 4, QueuePlayer[]> = {
    2: [],
    3: [],
    4: [],
  };

  private connections = new Map<string, (msg: string) => void>();
  private connToPlayerId = new Map<string, string>();
  private lastJoinTimestamp = new Map<string, number>();

  constructor(private roomCreator?: MatchRoomCreator) {}

  public getQueueCounts(): Record<2 | 3 | 4, number> {
    return {
      2: this.queues[2].length,
      3: this.queues[3].length,
      4: this.queues[4].length,
    };
  }

  public getTotalSearching(): number {
    return this.queues[2].length + this.queues[3].length + this.queues[4].length;
  }

  public broadcastQueueStatus() {
    const searchingCounts = this.getQueueCounts();
    const totalSearching = this.getTotalSearching();

    for (const [connId, send] of this.connections.entries()) {
      const playerId = this.connToPlayerId.get(connId);
      let myQueue: { targetCount: 2 | 3 | 4; currentCount: number; playersNeeded: number } | undefined;

      if (playerId) {
        for (const count of [2, 3, 4] as const) {
          const inQueue = this.queues[count].find((p) => p.playerId === playerId);
          if (inQueue) {
            myQueue = {
              targetCount: count,
              currentCount: this.queues[count].length,
              playersNeeded: Math.max(0, count - this.queues[count].length),
            };
            break;
          }
        }
      }

      const msg: LobbyServerMessage = {
        type: 'queue_status',
        searchingCounts,
        totalSearching,
        myQueue,
      };

      try {
        send(JSON.stringify(msg));
      } catch {
        // Safe catch
      }
    }
  }

  public handleConnection(connId: string, sendFn: (msg: string) => void) {
    this.connections.set(connId, sendFn);
    // Send immediate initial status
    try {
      const msg: LobbyServerMessage = {
        type: 'queue_status',
        searchingCounts: this.getQueueCounts(),
        totalSearching: this.getTotalSearching(),
      };
      sendFn(JSON.stringify(msg));
    } catch {
      // Safe catch
    }
  }

  public handleDisconnection(connId: string) {
    const playerId = this.connToPlayerId.get(connId);
    this.connections.delete(connId);
    this.connToPlayerId.delete(connId);
    this.lastJoinTimestamp.delete(connId);

    if (playerId) {
      this.removePlayerFromAllQueues(playerId);
      this.broadcastQueueStatus();
    }
  }

  public removePlayerFromAllQueues(playerId: string): boolean {
    let removed = false;
    for (const count of [2, 3, 4] as const) {
      const prevLen = this.queues[count].length;
      this.queues[count] = this.queues[count].filter((p) => p.playerId !== playerId);
      if (this.queues[count].length !== prevLen) {
        removed = true;
      }
    }
    return removed;
  }

  public handleMessage(
    connId: string,
    rawData: string,
    now: number = Date.now()
  ): { success: boolean; error?: string } | Promise<{ success: boolean; error?: string }> {
    const send = this.connections.get(connId);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      if (send) {
        send(JSON.stringify({ type: 'error', code: 'INVALID_JSON' }));
      }
      return { success: false, error: 'INVALID_JSON' };
    }

    const parseResult = LobbyClientMessageSchema.safeParse(parsed);
    if (!parseResult.success) {
      if (send) {
        send(JSON.stringify({ type: 'error', code: 'INVALID_SCHEMA' }));
      }
      return { success: false, error: 'INVALID_SCHEMA' };
    }

    const msg: LobbyClientMessage = parseResult.data;

    if (msg.type === 'queue_leave') {
      this.removePlayerFromAllQueues(msg.playerId);
      this.broadcastQueueStatus();
      return { success: true };
    }

    if (msg.type === 'queue_join') {
      // 1. Rate-limit queue joins to 1 per second per connection
      const lastJoin = this.lastJoinTimestamp.get(connId) || 0;
      if (now - lastJoin < 1000) {
        if (send) {
          send(JSON.stringify({ type: 'error', code: 'RATE_LIMITED', message: 'Max 1 join per second' }));
        }
        return { success: false, error: 'RATE_LIMITED' };
      }
      this.lastJoinTimestamp.set(connId, now);

      this.connToPlayerId.set(connId, msg.playerId);

      // 2. Remove player from any other queue (a player can only be in one queue at a time)
      this.removePlayerFromAllQueues(msg.playerId);

      // 3. Add to target queue
      this.queues[msg.targetCount].push({
        playerId: msg.playerId,
        connId,
        joinedAt: now,
        send: send || (() => {}),
      });

      // 4. Check if queue reached full human capacity
      if (this.queues[msg.targetCount].length >= msg.targetCount) {
        const matchRes = this.createMatch(msg.targetCount);
        if (matchRes instanceof Promise) {
          return matchRes.then(() => ({ success: true }));
        }
      } else {
        this.broadcastQueueStatus();
      }

      return { success: true };
    }

    return { success: false, error: 'UNKNOWN_MESSAGE' };
  }

  /**
   * Cold start check: called every 1s
   * If a queue has not filled after 6 seconds (5-7s window), fill missing seats with bots and start.
   * If at least one other human is waiting, they always get matched together.
   */
  public checkTimeouts(now: number = Date.now()): void | Promise<void> {
    for (const count of [2, 3, 4] as const) {
      const queue = this.queues[count];
      if (queue.length > 0) {
        const oldest = queue[0];
        if (now - oldest.joinedAt >= 6000) {
          return this.createMatchWithBots(count);
        }
      }
    }
  }

  /**
   * Matches full human group
   */
  public createMatch(targetCount: 2 | 3 | 4): void | Promise<void> {
    const players = this.queues[targetCount].splice(0, targetCount);

    // Shuffle seats randomly [0, ..., targetCount - 1]
    const seats = Array.from({ length: targetCount }, (_, i) => i);
    for (let i = seats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }

    const startingSeatIndex = Math.floor(Math.random() * targetCount);
    const gameConfig = getConfigForPlayers(targetCount);

    const seatTokens: Record<number, string> = {};
    for (let i = 0; i < players.length; i++) {
      seatTokens[seats[i]] = generateMatchToken();
    }
    let matchToken = generateMatchToken();

    const notifyPlayers = (roomCode: string, currentMatchToken: string) => {
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const sIndex = seats[i];
        const pToken = seatTokens[sIndex];
        const matchMsg: LobbyServerMessage = {
          type: 'match_found',
          roomCode,
          token: pToken,
          matchToken: currentMatchToken,
          seatIndex: sIndex,
          seatsCount: targetCount,
          startingSeatIndex,
          botSeats: [],
          countdownMs: 2000,
        };
        try {
          p.send(JSON.stringify(matchMsg));
        } catch {
          // Safe catch
        }
      }
      this.broadcastQueueStatus();
    };

    if (!this.roomCreator) {
      const roomCode = generateRoomCode();
      notifyPlayers(roomCode, matchToken);
      return;
    }

    return (async () => {
      let attempts = 0;
      let roomCode = generateRoomCode();
      while (attempts < 5) {
        attempts++;
        const res = await this.roomCreator!(roomCode, matchToken, {
          seatsCount: targetCount,
          startingSeatIndex,
          botSeats: [],
          seatTokens,
          config: gameConfig,
        });
        if (res.success) {
          notifyPlayers(roomCode, matchToken);
          return;
        }
        if (res.error === 'ROOM_TAKEN') {
          roomCode = generateRoomCode();
          matchToken = generateMatchToken();
          continue;
        }
        break;
      }
      // All attempts failed: tell players "server busy" and keep them in the queue
      this.queues[targetCount].unshift(...players);
      for (const p of players) {
        try {
          p.send(JSON.stringify({ type: 'server_busy' }));
        } catch {
          // Safe catch
        }
      }
      this.broadcastQueueStatus();
    })();
  }

  /**
   * Matches waiting humans with bots to fill remaining seats
   */
  public createMatchWithBots(targetCount: 2 | 3 | 4): void | Promise<void> {
    const humans = this.queues[targetCount].splice(0, targetCount);
    if (humans.length === 0) return;

    // Total seats
    const allSeats = Array.from({ length: targetCount }, (_, i) => i);
    // Shuffle seats randomly
    for (let i = allSeats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSeats[i], allSeats[j]] = [allSeats[j], allSeats[i]];
    }

    const humanSeats = allSeats.slice(0, humans.length);
    const botSeats = allSeats.slice(humans.length);
    const startingSeatIndex = Math.floor(Math.random() * targetCount);
    const gameConfig = getConfigForPlayers(targetCount);

    const seatTokens: Record<number, string> = {};
    for (let i = 0; i < humans.length; i++) {
      seatTokens[humanSeats[i]] = generateMatchToken();
    }
    let matchToken = generateMatchToken();

    const notifyPlayers = (roomCode: string, currentMatchToken: string) => {
      for (let i = 0; i < humans.length; i++) {
        const p = humans[i];
        const sIndex = humanSeats[i];
        const pToken = seatTokens[sIndex];
        const matchMsg: LobbyServerMessage = {
          type: 'match_found',
          roomCode,
          token: pToken,
          matchToken: currentMatchToken,
          seatIndex: sIndex,
          seatsCount: targetCount,
          startingSeatIndex,
          botSeats,
          countdownMs: 2000,
        };
        try {
          p.send(JSON.stringify(matchMsg));
        } catch {
          // Safe catch
        }
      }
      this.broadcastQueueStatus();
    };

    if (!this.roomCreator) {
      const roomCode = generateRoomCode();
      notifyPlayers(roomCode, matchToken);
      return;
    }

    return (async () => {
      let attempts = 0;
      let roomCode = generateRoomCode();
      while (attempts < 5) {
        attempts++;
        const res = await this.roomCreator!(roomCode, matchToken, {
          seatsCount: targetCount,
          startingSeatIndex,
          botSeats,
          seatTokens,
          config: gameConfig,
        });
        if (res.success) {
          notifyPlayers(roomCode, matchToken);
          return;
        }
        if (res.error === 'ROOM_TAKEN') {
          roomCode = generateRoomCode();
          matchToken = generateMatchToken();
          continue;
        }
        break;
      }
      // All attempts failed: tell players "server busy" and keep them in the queue
      this.queues[targetCount].unshift(...humans);
      for (const p of humans) {
        try {
          p.send(JSON.stringify({ type: 'server_busy' }));
        } catch {
          // Safe catch
        }
      }
      this.broadcastQueueStatus();
    })();
  }
}

/**
 * Lobby matchmaking Durable Object singleton (PartyServer on Cloudflare Workers)
 * URL: /parties/lobby/matchmaking
 */
export class Lobby extends Server<Env> {
  static options = { hibernate: false };

  public handler: LobbyHandler;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private createdAt = Date.now();
  private messageCount = 0;
  public lastActivityTimestamp = Date.now();
  public isExpired = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.handler = new LobbyHandler(async (roomCode, matchToken, config) => {
      try {
        const id = this.env.Main.idFromName(roomCode);
        const stub = this.env.Main.get(id);
        const res = await stub.fetch('http://main/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'create_match',
            matchToken,
            seatTokens: config.seatTokens,
            seatsCount: config.seatsCount,
            startingSeatIndex: config.startingSeatIndex,
            botSeats: config.botSeats,
            config: config.config,
          }),
        });
        if (res.status === 409) {
          return { success: false, error: 'ROOM_TAKEN' };
        }
        return { success: res.ok };
      } catch {
        return { success: false, error: 'NETWORK_ERROR' };
      }
    });

    this.tickInterval = setInterval(() => {
      this.tick(Date.now());
    }, 1000);
  }

  private devLog(msg: string, extra?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      const activeSeconds = Math.floor((Date.now() - this.createdAt) / 1000);
      console.log(`[realtime:lobby] (${activeSeconds}s active, msgs: ${this.messageCount}) ${msg}`, extra ?? '');
    }
  }

  get queues() {
    return this.handler.queues;
  }

  get totalSearching(): number {
    return this.handler.getTotalSearching();
  }

  public tick(now: number = Date.now()) {
    this.handler.checkTimeouts(now);

    // 10 minute idle cleanup
    const totalSearching = this.handler.getTotalSearching();
    if (totalSearching === 0 && now - this.lastActivityTimestamp >= 10 * 60 * 1000) {
      this.isExpired = true;
      this.cleanupLobby();
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

  async onAlarm() {
    const now = Date.now();
    this.devLog('Alarm fired', { now });
    this.tick(now);
  }

  public cleanupLobby() {
    this.devLog('Cleaning up idle lobby queues');
    this.handler.queues[2] = [];
    this.handler.queues[3] = [];
    this.handler.queues[4] = [];
    try {
      this.ctx.storage?.deleteAll();
    } catch {
      // Safe catch
    }
  }

  onConnect(conn: Connection, _ctx?: ConnectionContext) {
    this.messageCount++;
    this.lastActivityTimestamp = Date.now();
    this.devLog(`Client connected: ${conn.id}`);

    this.handler.handleConnection(conn.id, (msg: string) => {
      try {
        conn.send(msg);
      } catch {
        // Safe catch
      }
    });
  }

  onMessage(a: any, b: any) {
    this.messageCount++;
    this.lastActivityTimestamp = Date.now();
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
      this.devLog(`Message from ${conn?.id}: ${message}`);
      this.handler.handleMessage(conn?.id ?? '', message, Date.now());
    }
  }

  onClose(conn: Connection) {
    this.devLog(`Client disconnected: ${conn.id}`);
    this.handler.handleDisconnection(conn.id);
    this.lastActivityTimestamp = Date.now();
    if (this.handler.getTotalSearching() === 0) {
      this.scheduleAlarm(Date.now() + 10 * 60 * 1000);
    }
  }

  onError(conn: Connection) {
    this.devLog(`Client error: ${conn.id}`);
    this.handler.handleDisconnection(conn.id);
    this.lastActivityTimestamp = Date.now();
    if (this.handler.getTotalSearching() === 0) {
      this.scheduleAlarm(Date.now() + 10 * 60 * 1000);
    }
  }
}

export default Lobby;
