import { describe, it, expect, beforeEach } from 'vitest';
import { LobbyHandler, Lobby } from './lobby';
import { LobbyServerMessage } from '../src/lib/types';

describe('Vanish XO - Matchmaking Lobby Server', () => {
  let lobby: LobbyHandler;
  let client1Messages: LobbyServerMessage[];
  let client2Messages: LobbyServerMessage[];
  let client3Messages: LobbyServerMessage[];
  let client4Messages: LobbyServerMessage[];

  beforeEach(() => {
    lobby = new LobbyHandler();
    client1Messages = [];
    client2Messages = [];
    client3Messages = [];
    client4Messages = [];

    lobby.handleConnection('conn1', (msg) => client1Messages.push(JSON.parse(msg)));
    lobby.handleConnection('conn2', (msg) => client2Messages.push(JSON.parse(msg)));
    lobby.handleConnection('conn3', (msg) => client3Messages.push(JSON.parse(msg)));
    lobby.handleConnection('conn4', (msg) => client4Messages.push(JSON.parse(msg)));
  });

  it('2P queue fills with 2 humans and triggers match_found', async () => {
    const t0 = 1000;
    // Human 1 joins 2P
    const res1 = await lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }), t0);
    expect(res1.success).toBe(true);
    expect(lobby.queues[2].length).toBe(1);

    // Human 2 joins 2P
    const res2 = await lobby.handleMessage('conn2', JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 2 }), t0);
    expect(res2.success).toBe(true);

    // Queue must now be empty (matched!)
    expect(lobby.queues[2].length).toBe(0);

    // Both players must receive match_found
    const match1 = client1Messages.find((m) => m.type === 'match_found');
    const match2 = client2Messages.find((m) => m.type === 'match_found');

    expect(match1).toBeDefined();
    expect(match2).toBeDefined();

    if (match1?.type === 'match_found' && match2?.type === 'match_found') {
      expect(match1.roomCode).toBe(match2.roomCode);
      expect(match1.seatsCount).toBe(2);
      expect(match2.seatsCount).toBe(2);
      expect(match1.botSeats).toEqual([]);
      expect(match2.botSeats).toEqual([]);
      // Distinct seats (0 and 1)
      expect(new Set([match1.seatIndex, match2.seatIndex])).toEqual(new Set([0, 1]));
    }
  });

  it('3P queue fills with 3 humans and triggers match_found', () => {
    const t0 = 1000;
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 3 }), t0);
    lobby.handleMessage('conn2', JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 3 }), t0);
    expect(lobby.queues[3].length).toBe(2);

    lobby.handleMessage('conn3', JSON.stringify({ type: 'queue_join', playerId: 'p3', targetCount: 3 }), t0);
    expect(lobby.queues[3].length).toBe(0);

    const match1 = client1Messages.find((m) => m.type === 'match_found');
    const match2 = client2Messages.find((m) => m.type === 'match_found');
    const match3 = client3Messages.find((m) => m.type === 'match_found');

    expect(match1).toBeDefined();
    expect(match2).toBeDefined();
    expect(match3).toBeDefined();

    if (match1?.type === 'match_found' && match2?.type === 'match_found' && match3?.type === 'match_found') {
      expect(match1.roomCode).toBe(match2.roomCode);
      expect(match2.roomCode).toBe(match3.roomCode);
      expect(match1.seatsCount).toBe(3);
      expect(match1.botSeats).toEqual([]);
      expect(new Set([match1.seatIndex, match2.seatIndex, match3.seatIndex])).toEqual(new Set([0, 1, 2]));
    }
  });

  it('queue times out into bots after 15 seconds (2 humans in 4P queue paired with 2 bots)', () => {
    const t0 = 1000;
    // Human 1 and Human 2 join 4P queue
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 4 }), t0);
    lobby.handleMessage('conn2', JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 4 }), t0 + 2000);
    expect(lobby.queues[4].length).toBe(2);

    // At 14 seconds (t0 + 14000), timeout has not triggered
    lobby.checkTimeouts(t0 + 14000);
    expect(lobby.queues[4].length).toBe(2);

    // At 15 seconds (t0 + 15000), timeout triggers!
    lobby.checkTimeouts(t0 + 15000);
    expect(lobby.queues[4].length).toBe(0); // Matched!

    const match1 = client1Messages.find((m) => m.type === 'match_found');
    const match2 = client2Messages.find((m) => m.type === 'match_found');

    expect(match1).toBeDefined();
    expect(match2).toBeDefined();

    if (match1?.type === 'match_found' && match2?.type === 'match_found') {
      expect(match1.roomCode).toBe(match2.roomCode);
      expect(match1.seatsCount).toBe(4);
      // Both humans matched together
      expect(match1.seatIndex).not.toBe(match2.seatIndex);
      // Remaining 2 seats filled with bots
      expect(match1.botSeats.length).toBe(2);
      expect(match2.botSeats.length).toBe(2);
      expect(match1.botSeats).toEqual(match2.botSeats);

      const allSeats = new Set([match1.seatIndex, match2.seatIndex, ...match1.botSeats]);
      expect(allSeats).toEqual(new Set([0, 1, 2, 3]));
    }
  });

  it('cancel removes the player from the queue', () => {
    const t0 = 1000;
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }), t0);
    expect(lobby.queues[2].length).toBe(1);

    // Human 1 cancels
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_leave', playerId: 'p1' }), t0 + 100);
    expect(lobby.queues[2].length).toBe(0);
  });

  it('disconnect removes the player from the queue', () => {
    const t0 = 1000;
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 3 }), t0);
    expect(lobby.queues[3].length).toBe(1);

    // Connection drops
    lobby.handleDisconnection('conn1');
    expect(lobby.queues[3].length).toBe(0);
  });

  it('enforces 1 queue join per second rate limiting per connection', async () => {
    const t0 = 1000;
    const res1 = await lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }), t0);
    expect(res1.success).toBe(true);

    // Rapid second join within 500ms
    const res2 = await lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 3 }), t0 + 500);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('RATE_LIMITED');
  });

  it('ensures a player can only be in one queue at a time', () => {
    const t0 = 1000;
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }), t0);
    expect(lobby.queues[2].length).toBe(1);

    // After 1.1s, player switches to 4P queue
    lobby.handleMessage('conn1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 4 }), t0 + 1100);
    expect(lobby.queues[2].length).toBe(0); // Removed from 2P
    expect(lobby.queues[4].length).toBe(1); // Added to 4P
  });

  it('retries with new room code when roomCreator returns ROOM_TAKEN', async () => {
    const attemptedCodes: string[] = [];
    const attemptedTokens: string[] = [];
    let callCount = 0;

    const retryLobby = new LobbyHandler(async (roomCode, matchToken) => {
      callCount++;
      attemptedCodes.push(roomCode);
      attemptedTokens.push(matchToken);
      if (callCount < 3) {
        return { success: false, error: 'ROOM_TAKEN' };
      }
      return { success: true };
    });

    const msgs: LobbyServerMessage[] = [];
    retryLobby.handleConnection('c1', (msg) => msgs.push(JSON.parse(msg)));
    retryLobby.handleConnection('c2', (msg) => msgs.push(JSON.parse(msg)));

    retryLobby.handleMessage('c1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }), 1000);
    retryLobby.handleMessage('c2', JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 2 }), 1000);

    // Wait microtask tick for async roomCreator loop
    await new Promise((r) => setTimeout(r, 20));

    expect(callCount).toBe(3);
    expect(attemptedCodes.length).toBe(3);
    // Unique codes were tried
    expect(new Set(attemptedCodes).size).toBe(3);
    expect(attemptedCodes.every((c) => c.length === 5)).toBe(true);

    const match = msgs.find((m) => m.type === 'match_found');
    expect(match).toBeDefined();
    if (match?.type === 'match_found') {
      expect(match.roomCode).toBe(attemptedCodes[2]);
      expect(match.matchToken).toBe(attemptedTokens[2]);
    }
  });
});

describe('Lobby Durable Object Class API (partyserver)', () => {
  function createMockConn(id: string) {
    const messages: LobbyServerMessage[] = [];
    return {
      id,
      send: (msg: string) => messages.push(JSON.parse(msg)),
      close: () => {},
      messages,
    };
  }

  function createMockDOState(roomName: string) {
    let alarmTime: number | null = null;
    const storageMap = new Map<string, any>();
    return {
      id: { name: roomName, toString: () => roomName },
      storage: {
        get: async (key: string) => storageMap.get(key),
        put: async (key: string, val: any) => storageMap.set(key, val),
        delete: async (key: string) => storageMap.delete(key),
        deleteAll: async () => storageMap.clear(),
        setAlarm: async (time: number | Date) => {
          alarmTime = typeof time === 'number' ? time : time.getTime();
        },
        getAlarm: async () => alarmTime,
        deleteAlarm: async () => {
          alarmTime = null;
        },
      },
      blockConcurrencyWhile: async (fn: any) => fn(),
      waitUntil: (_p: any) => {},
      acceptWebSocket: (_ws: any, _tags: any) => {},
      getWebSockets: () => [],
    } as unknown as DurableObjectState;
  }

  it('matches 2 players into a room reached through env.Main binding', async () => {
    let createMatchCalls: any[] = [];
    const mockEnv = {
      Main: {
        idFromName: (name: string) => ({ name, toString: () => name }),
        get: (_id: any) => ({
          fetch: async (_url: string, init?: any) => {
            const body = JSON.parse(init.body);
            createMatchCalls.push(body);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
          },
        }),
      },
      Lobby: {
        idFromName: (name: string) => ({ name, toString: () => name }),
        get: (_id: any) => ({
          fetch: async () => new Response('ok'),
        }),
      },
    } as any;

    const state = createMockDOState('matchmaking');
    const lobbyServer = new Lobby(state, mockEnv);

    const conn1 = createMockConn('c1');
    const conn2 = createMockConn('c2');

    lobbyServer.onConnect(conn1 as any);
    lobbyServer.onConnect(conn2 as any);

    const t0 = 1000;
    lobbyServer.onMessage(conn1 as any, JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }));
    await lobbyServer.onMessage(conn2 as any, JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 2 }));

    // Wait microtask tick for async room creator
    await new Promise((r) => setTimeout(r, 20));

    // Verify room was created via env.Main binding
    expect(createMatchCalls.length).toBe(1);
    expect(createMatchCalls[0].type).toBe('create_match');
    expect(createMatchCalls[0].seatsCount).toBe(2);

    // Both players received match_found
    const m1 = conn1.messages.find((m) => m.type === 'match_found');
    const m2 = conn2.messages.find((m) => m.type === 'match_found');
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    if (m1?.type === 'match_found' && m2?.type === 'match_found') {
      expect(m1.roomCode).toBe(m2.roomCode);
      expect(m1.seatsCount).toBe(2);
    }
  });

  it('matches waiting players with bots after 15 seconds timeout via Lobby class API', async () => {
    let createdWithBots: any = null;
    const mockEnv = {
      Main: {
        idFromName: (name: string) => ({ name, toString: () => name }),
        get: (_id: any) => ({
          fetch: async (_url: string, init?: any) => {
            createdWithBots = JSON.parse(init.body);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
          },
        }),
      },
      Lobby: {
        idFromName: (name: string) => ({ name, toString: () => name }),
        get: (_id: any) => ({
          fetch: async () => new Response('ok'),
        }),
      },
    } as any;

    const state = createMockDOState('matchmaking');
    const lobbyServer = new Lobby(state, mockEnv);

    const conn1 = createMockConn('c1');
    lobbyServer.onConnect(conn1 as any);

    const now = Date.now();
    lobbyServer.onMessage(conn1 as any, JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }));
    expect(lobbyServer.queues[2].length).toBe(1);

    // 14 seconds later: no match yet
    lobbyServer.tick(now + 14000);
    expect(lobbyServer.queues[2].length).toBe(1);

    // 15 seconds later: bot fallback triggered!
    await lobbyServer.tick(now + 16000);
    await new Promise((r) => setTimeout(r, 50));

    expect(lobbyServer.queues[2].length).toBe(0);
    expect(createdWithBots).not.toBeNull();
    expect(createdWithBots.botSeats.length).toBe(1);

    const matchFound = conn1.messages.find((m) => m.type === 'match_found');
    expect(matchFound).toBeDefined();
  });

  it('cleans up idle lobby after 10 minutes of inactivity', () => {
    const mockEnv = {
      Main: { idFromName: () => ({}), get: () => ({}) },
      Lobby: { idFromName: () => ({}), get: () => ({}) },
    } as any;

    const state = createMockDOState('matchmaking');
    const lobbyServer = new Lobby(state, mockEnv);

    const t0 = 1000;
    lobbyServer.lastActivityTimestamp = t0;

    // 9 minutes: not expired
    lobbyServer.tick(t0 + 9 * 60 * 1000);
    expect(lobbyServer.isExpired).toBe(false);

    // 10 minutes: expired and cleaned up
    lobbyServer.tick(t0 + 10 * 60 * 1000);
    expect(lobbyServer.isExpired).toBe(true);
  });
});


