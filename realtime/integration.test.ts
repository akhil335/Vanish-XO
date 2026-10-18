import { describe, it, expect } from 'vitest';
import { Main } from './room';
import { Lobby } from './lobby';
import { RoomState, ServerMessage, MarkSymbol, generateRoomCode, LobbyServerMessage } from '../src/lib/types';

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

const mockEnv = {
  Main: {
    idFromName: (name: string) => ({ name, toString: () => name }),
    get: (_id: any) => ({
      fetch: async (_url: string, _init?: any) => new Response(JSON.stringify({ success: true }), { status: 200 }),
    }),
  },
  Lobby: {
    idFromName: (name: string) => ({ name, toString: () => name }),
    get: (_id: any) => ({
      fetch: async () => new Response('ok'),
    }),
  },
} as any;

class MockPartyClient {
  public id: string;
  private server: any;
  public messages: any[] = [];
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(server: any, id: string = 'client_' + Math.random().toString(36).slice(2, 7)) {
    this.server = server;
    this.id = id;

    const conn = {
      id: this.id,
      send: (raw: string) => {
        const parsed = JSON.parse(raw);
        this.messages.push(parsed);
        const callbacks = this.listeners['message'] || [];
        callbacks.forEach((cb) => cb({ data: raw }));
      },
      close: () => {
        const callbacks = this.listeners['close'] || [];
        callbacks.forEach((cb) => cb({}));
      },
    };

    server.onConnect(conn);
  }

  send(data: string) {
    this.server.onMessage({ id: this.id }, data);
  }

  addEventListener(event: string, cb: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    if (event === 'open') {
      setTimeout(() => cb({}), 0);
    }
  }

  close() {
    this.server.onClose({ id: this.id });
  }
}

describe('Vanish XO - Multi-Client Integration Tests (PartyServer on Cloudflare Workers)', () => {
  it('connects two live clients to a 3-player room with 1 bot and completes moves', async () => {
    const roomCode = generateRoomCode();
    const mainState = createMockDOState(roomCode);
    const mainServer = new Main(mainState, mockEnv);

    // Client 1 (Host: Player 1)
    const client1 = new MockPartyClient(mainServer);
    // Client 2 (Player 2)
    const client2 = new MockPartyClient(mainServer);

    const states: { s1: RoomState | null; s2: RoomState | null } = { s1: null, s2: null };

    client1.addEventListener('message', (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'state') {
        states.s1 = msg.state;
      }
    });

    client2.addEventListener('message', (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'state') {
        states.s2 = msg.state;
      }
    });

    // 1. Host creates room
    client1.send(JSON.stringify({ type: 'create', playerId: 'human_host' }));
    expect(states.s1?.status).toBe('waiting');

    // 2. Host configures room for 3 seats
    client1.send(JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    expect(states.s1?.seatsCount).toBe(3);

    // 3. Host fills seat 2 with a bot
    client1.send(JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    expect(states.s1?.seats[2].isBot).toBe(true);

    // 4. Player 2 joins
    client2.send(JSON.stringify({ type: 'join', playerId: 'human_player2' }));
    expect(states.s1?.seats[1].playerId).toBe('human_player2');

    // 5. Player 2 readies up
    client2.send(JSON.stringify({ type: 'ready', ready: true }));
    expect(states.s1?.seats[1].isReady).toBe(true);

    // 6. Host starts the game
    client1.send(JSON.stringify({ type: 'start' }));
    expect(states.s1?.status).toBe('playing');
    expect(states.s1?.turnSeatIndex).toBe(0); // Host's turn ('X')

    // 7. Host plays cell 0
    client1.send(JSON.stringify({ type: 'place', cell: 0 }));
    expect(states.s1?.board[0]).toBe('X');
    expect(states.s1?.turnSeatIndex).toBe(1); // Player 2's turn ('O')

    // 8. Player 2 plays cell 3
    client2.send(JSON.stringify({ type: 'place', cell: 3 }));
    expect(states.s2?.board[3]).toBe('O');

    // 9. Bot's turn (Seat 2, '▲') automatically executes
    await new Promise((r) => setTimeout(r, 2600));

    // Confirm that Bot placed a mark on the board!
    const botMarkPlaced = states.s1?.board.some((c: MarkSymbol | null) => c === '▲');
    expect(botMarkPlaced).toBe(true);

    // Turn rotated back to Seat 0 (Host)!
    expect(states.s1?.turnSeatIndex).toBe(0);

    client1.close();
    client2.close();
  });

  it('handles 4 clients: two in 2P match immediately, two in 4P match after 15s timeout with 2 bots', async () => {
    let createdRooms: any[] = [];
    const customEnv = {
      Main: {
        idFromName: (name: string) => ({ name, toString: () => name }),
        get: (_id: any) => ({
          fetch: async (_url: string, init?: any) => {
            const body = JSON.parse(init.body);
            createdRooms.push(body);
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

    const lobbyState = createMockDOState('matchmaking');
    const lobbyServer = new Lobby(lobbyState, customEnv);

    // 4 clients connecting to the lobby
    const p1 = new MockPartyClient(lobbyServer);
    const p2 = new MockPartyClient(lobbyServer);
    const p3 = new MockPartyClient(lobbyServer);
    const p4 = new MockPartyClient(lobbyServer);

    const p1Matches: any[] = [];
    const p2Matches: any[] = [];
    const p3Matches: any[] = [];
    const p4Matches: any[] = [];

    p1.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'match_found') p1Matches.push(msg);
    });
    p2.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'match_found') p2Matches.push(msg);
    });
    p3.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'match_found') p3Matches.push(msg);
    });
    p4.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'match_found') p4Matches.push(msg);
    });

    const now = Date.now();

    // 1. Two players join 2P queue
    p1.send(JSON.stringify({ type: 'queue_join', playerId: 'live_user_2p_1', targetCount: 2 }));
    p2.send(JSON.stringify({ type: 'queue_join', playerId: 'live_user_2p_2', targetCount: 2 }));

    // 2. Two players join 4P queue
    p3.send(JSON.stringify({ type: 'queue_join', playerId: 'live_user_4p_1', targetCount: 4 }));
    p4.send(JSON.stringify({ type: 'queue_join', playerId: 'live_user_4p_2', targetCount: 4 }));

    // 2P pair should match immediately
    await new Promise((r) => setTimeout(r, 20));

    expect(p1Matches.length).toBe(1);
    expect(p2Matches.length).toBe(1);
    expect(p1Matches[0].seatsCount).toBe(2);
    expect(p2Matches[0].seatsCount).toBe(2);
    expect(p1Matches[0].roomCode).toBe(p2Matches[0].roomCode);
    expect(p1Matches[0].botSeats).toEqual([]);

    // 4P pair should NOT have matched yet (needs 4 players or 15s timeout)
    expect(p3Matches.length).toBe(0);
    expect(p4Matches.length).toBe(0);

    // Trigger 15s timeout into bots
    await lobbyServer.tick(now + 15500);
    await new Promise((r) => setTimeout(r, 20));

    // 4P pair should now be matched with 2 bots!
    expect(p3Matches.length).toBe(1);
    expect(p4Matches.length).toBe(1);
    expect(p3Matches[0].seatsCount).toBe(4);
    expect(p4Matches[0].seatsCount).toBe(4);
    expect(p3Matches[0].roomCode).toBe(p4Matches[0].roomCode);
    expect(p3Matches[0].botSeats.length).toBe(2);
    expect(p4Matches[0].botSeats.length).toBe(2);

    p1.close();
    p2.close();
    p3.close();
    p4.close();
  });

  it('runs 3-tab live flow: lobby states, guest ready, seats change reset, game, home leave, and host transfer', async () => {
    const roomCode = generateRoomCode();
    const mainState = createMockDOState(roomCode);
    const mainServer = new Main(mainState, mockEnv);

    const tabHost = new MockPartyClient(mainServer);
    const tabGuest1 = new MockPartyClient(mainServer);
    const tabGuest2 = new MockPartyClient(mainServer);

    const hostStates: RoomState[] = [];
    const guest1States: RoomState[] = [];
    const guest2States: RoomState[] = [];

    tabHost.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') hostStates.push(msg.state);
    });
    tabGuest1.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') guest1States.push(msg.state);
    });
    tabGuest2.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') guest2States.push(msg.state);
    });

    // 1. Host creates and configures 3-player room
    tabHost.send(JSON.stringify({ type: 'create', playerId: 'live_host' }));
    tabHost.send(JSON.stringify({ type: 'set_seats', seatsCount: 3 }));

    const latestHostState1 = hostStates[hostStates.length - 1];
    expect(latestHostState1.seatsCount).toBe(3);
    // Seats 1 and 2 are EMPTY
    expect(latestHostState1.seats[1].playerId).toBeNull();
    expect(latestHostState1.seats[2].playerId).toBeNull();

    // 2. Guest 1 joins
    tabGuest1.send(JSON.stringify({ type: 'join', playerId: 'live_guest1' }));
    const latestHostState2 = hostStates[hostStates.length - 1];
    expect(latestHostState2.seats[1].playerId).toBe('live_guest1');
    expect(latestHostState2.seats[1].isReady).toBe(false); // JOINED, NOT READY

    // 3. Guest 1 readies up
    tabGuest1.send(JSON.stringify({ type: 'ready', ready: true }));
    expect(hostStates[hostStates.length - 1].seats[1].isReady).toBe(true); // READY

    // 4. Host changes seatsCount to 4 -> guest 1's ready state must be reset to FALSE!
    tabHost.send(JSON.stringify({ type: 'set_seats', seatsCount: 4 }));
    expect(hostStates[hostStates.length - 1].seats[1].isReady).toBe(false);

    // 5. Host switches back to 3 seats
    tabHost.send(JSON.stringify({ type: 'set_seats', seatsCount: 3 }));

    // Guest 1 readies up again
    tabGuest1.send(JSON.stringify({ type: 'ready', ready: true }));
    // Guest 2 joins and readies up
    tabGuest2.send(JSON.stringify({ type: 'join', playerId: 'live_guest2' }));
    tabGuest2.send(JSON.stringify({ type: 'ready', ready: true }));

    expect(hostStates[hostStates.length - 1].seats.every((s) => s.isReady)).toBe(true);

    // 6. Host starts game
    tabHost.send(JSON.stringify({ type: 'start' }));
    expect(hostStates[hostStates.length - 1].status).toBe('playing');

    // 7. Make valid moves
    tabHost.send(JSON.stringify({ type: 'place', cell: 0 }));
    tabGuest1.send(JSON.stringify({ type: 'place', cell: 1 }));
    tabGuest2.send(JSON.stringify({ type: 'place', cell: 2 }));

    expect(hostStates[hostStates.length - 1].board[0]).toBe('X');
    expect(hostStates[hostStates.length - 1].board[1]).toBe('O');
    expect(hostStates[hostStates.length - 1].board[2]).toBe('▲');

    // 8. Host leaves mid-game -> Seat 0 taken over by Bot, host transferred to Guest 1
    tabHost.send(JSON.stringify({ type: 'leave' }));
    const afterLeave = guest1States[guest1States.length - 1];

    expect(afterLeave.seats[0].isBot).toBe(true);
    expect(afterLeave.hostPlayerId).toBe('live_guest1');

    tabHost.close();
    tabGuest1.close();
    tabGuest2.close();
  });

  describe('Matchmaking & Room Initialization Server Tests', () => {
    function setupConnectedEnvironment() {
      const roomInstances = new Map<string, Main>();

      const env = {
        Main: {
          idFromName: (name: string) => ({ name, toString: () => name }),
          get: (id: any) => {
            let room = roomInstances.get(id.name);
            if (!room) {
              const state = createMockDOState(id.name);
              room = new Main(state, env as any);
              roomInstances.set(id.name, room);
            }
            return {
              fetch: async (url: string, init?: any) => {
                const req = new Request(url, init);
                return room!.onRequest(req);
              },
            };
          },
        },
        Lobby: {
          idFromName: (name: string) => ({ name, toString: () => name }),
          get: (_id: any) => ({
            fetch: async () => new Response('ok'),
          }),
        },
      } as any;

      const lobbyState = createMockDOState('lobby-integration');
      const lobbyServer = new Lobby(lobbyState, env);

      return {
        env,
        lobbyServer,
        roomInstances,
        cleanup: () => {
          if ((lobbyServer as any).tickInterval) {
            clearInterval((lobbyServer as any).tickInterval);
          }
        },
      };
    }

    it('1. Two humans queue for 2P and both join an initialized room without ROOM_NOT_FOUND', async () => {
      const { lobbyServer, roomInstances, cleanup } = setupConnectedEnvironment();

      const p1 = new MockPartyClient(lobbyServer, 'client_p1');
      const p2 = new MockPartyClient(lobbyServer, 'client_p2');

      let m1: LobbyServerMessage | null = null;
      let m2: LobbyServerMessage | null = null;

      p1.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m1 = msg;
      });
      p2.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m2 = msg;
      });

      p1.send(JSON.stringify({ type: 'queue_join', playerId: 'human_1', targetCount: 2 }));
      p2.send(JSON.stringify({ type: 'queue_join', playerId: 'human_2', targetCount: 2 }));

      await new Promise((r) => setTimeout(r, 50));

      expect(m1).not.toBeNull();
      expect(m2).not.toBeNull();
      expect((m1 as any).roomCode).toBe((m2 as any).roomCode);
      const roomCode = (m1 as any).roomCode;

      // Both players received per-seat tokens
      expect((m1 as any).token).toBeDefined();
      expect((m2 as any).token).toBeDefined();
      expect((m1 as any).token).not.toBe((m2 as any).token);

      // Verify the room was initialized in Main BEFORE players connect
      const room = roomInstances.get(roomCode);
      expect(room).toBeDefined();
      expect(room!.handler.state.status).toBe('waiting');

      // Now both players connect to the room
      const roomP1 = new MockPartyClient(room!, 'room_p1');
      const roomP2 = new MockPartyClient(room!, 'room_p2');

      const p1States: any[] = [];
      const p2States: any[] = [];
      const p1Errors: any[] = [];
      const p2Errors: any[] = [];

      roomP1.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') p1States.push(msg.state);
        if (msg.type === 'error') p1Errors.push(msg);
      });
      roomP2.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') p2States.push(msg.state);
        if (msg.type === 'error') p2Errors.push(msg);
      });

      // Join room passing per-seat matchToken (even if client attempts to spoof a different seatIndex in matchConfig)
      const spoofedSeat = ((m1 as any).seatIndex === 0 ? 1 : 0) as 0 | 1;
      roomP1.send(
        JSON.stringify({
          type: 'join',
          playerId: 'human_1',
          matchToken: (m1 as any).token,
          matchConfig: { seatsCount: 2, assignedSeatIndex: spoofedSeat, startingSeatIndex: 0, botSeats: [] },
        })
      );
      roomP2.send(JSON.stringify({ type: 'join', playerId: 'human_2', matchToken: (m2 as any).token }));

      await new Promise((r) => setTimeout(r, 50));

      // Neither player saw ROOM_NOT_FOUND
      expect(p1Errors).toHaveLength(0);
      expect(p2Errors).toHaveLength(0);

      // Seats are assigned strictly from tokens (ignoring spoofed seat)
      const finalState = room!.handler.state;
      const p1Seat = finalState.seats.find((s) => s.playerId === 'human_1');
      const p2Seat = finalState.seats.find((s) => s.playerId === 'human_2');
      expect(p1Seat?.seatIndex).toBe((m1 as any).seatIndex);
      expect(p2Seat?.seatIndex).toBe((m2 as any).seatIndex);

      // Both humans present -> matched room transitions straight to playing!
      expect(finalState.status).toBe('playing');
      expect(finalState.phase).toBe('playing');

      cleanup();
    });

    it('2. Queue timeout creates a room with bots and the human joins it', async () => {
      const { lobbyServer, roomInstances, cleanup } = setupConnectedEnvironment();

      const p1 = new MockPartyClient(lobbyServer, 'client_timeout');
      let matchMsg: LobbyServerMessage | null = null;

      p1.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') matchMsg = msg;
      });

      const now = Date.now();
      p1.send(JSON.stringify({ type: 'queue_join', playerId: 'solo_human', targetCount: 2 }));

      // Advance by 15 seconds to trigger bot fallback
      await lobbyServer.tick(now + 15500);
      await new Promise((r) => setTimeout(r, 50));

      expect(matchMsg).not.toBeNull();
      const match = matchMsg as any;
      expect(match.seatsCount).toBe(2);
      expect(match.botSeats.length).toBe(1);

      // Room was created with bot in bot seat
      const room = roomInstances.get(match.roomCode);
      expect(room).toBeDefined();
      const botSeatIdx = match.botSeats[0];
      expect(room!.handler.state.seats[botSeatIdx].isBot).toBe(true);

      // Human joins with per-seat token
      const roomClient = new MockPartyClient(room!, 'room_solo');
      const states: any[] = [];
      const errors: any[] = [];

      roomClient.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') states.push(msg.state);
        if (msg.type === 'error') errors.push(msg);
      });

      roomClient.send(JSON.stringify({ type: 'join', playerId: 'solo_human', matchToken: match.token }));
      await new Promise((r) => setTimeout(r, 50));

      expect(errors).toHaveLength(0);
      // Because all human seats (1 human) are present, room transitions straight to playing
      expect(room!.handler.state.status).toBe('playing');
      const humanSeat = room!.handler.state.seats.find((s) => s.playerId === 'solo_human');
      expect(humanSeat).toBeDefined();
      expect(humanSeat?.seatIndex).toBe(match.seatIndex);

      cleanup();
    });

    it('3. 3P and 4P quick match with a mix of humans and bots', async () => {
      const { lobbyServer, roomInstances, cleanup } = setupConnectedEnvironment();

      // Test 3P with 2 humans and 1 bot fallback
      const p1 = new MockPartyClient(lobbyServer, 'c3p_1');
      const p2 = new MockPartyClient(lobbyServer, 'c3p_2');

      let m3p1: any = null;
      let m3p2: any = null;
      p1.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m3p1 = msg;
      });
      p2.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m3p2 = msg;
      });

      const now = Date.now();
      p1.send(JSON.stringify({ type: 'queue_join', playerId: 'h3p_1', targetCount: 3 }));
      p2.send(JSON.stringify({ type: 'queue_join', playerId: 'h3p_2', targetCount: 3 }));

      // Trigger 15s timeout
      await lobbyServer.tick(now + 16000);
      await new Promise((r) => setTimeout(r, 50));

      expect(m3p1).not.toBeNull();
      expect(m3p1.seatsCount).toBe(3);
      expect(m3p1.botSeats.length).toBe(1);

      const room3P = roomInstances.get(m3p1.roomCode)!;
      expect(room3P).toBeDefined();

      const r1 = new MockPartyClient(room3P, 'r1');
      const r2 = new MockPartyClient(room3P, 'r2');
      r1.send(JSON.stringify({ type: 'join', playerId: 'h3p_1', matchToken: m3p1.token }));
      r2.send(JSON.stringify({ type: 'join', playerId: 'h3p_2', matchToken: m3p2.token }));

      await new Promise((r) => setTimeout(r, 50));
      expect(room3P.handler.state.status).toBe('playing');
      expect(room3P.handler.state.config.gridSize).toBe(5);

      cleanup();
    });

    it('4. Join before create is rejected with ROOM_NOT_FOUND, but a created room is never reported as missing', async () => {
      const { env } = setupConnectedEnvironment();

      // Connect to a brand new uncreated room DO
      const uncreatedState = createMockDOState('UNCREATED');
      const uncreatedRoom = new Main(uncreatedState, env);

      const client = new MockPartyClient(uncreatedRoom, 'premature_joiner');
      const errors: any[] = [];
      client.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'error') errors.push(msg);
      });

      // Join sent before create -> rejected with ROOM_NOT_FOUND
      client.send(JSON.stringify({ type: 'join', playerId: 'p_early' }));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('ROOM_NOT_FOUND');

      // Now create the room properly via initMatch
      const createRes = uncreatedRoom.handler.initMatch('valid_token', 2, 0, [], { 0: 'tok_0', 1: 'tok_1' });
      expect(createRes.success).toBe(true);

      // Now join with valid token -> succeeded, NEVER reported missing!
      errors.length = 0;
      const validClient = new MockPartyClient(uncreatedRoom, 'proper_joiner');
      validClient.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'error') errors.push(msg);
      });

      validClient.send(JSON.stringify({ type: 'join', playerId: 'p_valid', matchToken: 'tok_0' }));
      expect(errors).toHaveLength(0);
      expect(uncreatedRoom.handler.state.seats[0].playerId).toBe('p_valid');
    });

    it('5. Refresh after match found still works and reclaims the same seat', async () => {
      const { lobbyServer, roomInstances, cleanup } = setupConnectedEnvironment();

      const p1 = new MockPartyClient(lobbyServer, 'client_refresher');
      const p2 = new MockPartyClient(lobbyServer, 'client_p2_other');
      let m1: any = null;
      let m2: any = null;

      p1.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m1 = msg;
      });
      p2.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'match_found') m2 = msg;
      });

      p1.send(JSON.stringify({ type: 'queue_join', playerId: 'refresh_player', targetCount: 2 }));
      p2.send(JSON.stringify({ type: 'queue_join', playerId: 'other_player', targetCount: 2 }));

      await new Promise((r) => setTimeout(r, 50));
      const room = roomInstances.get(m1.roomCode)!;

      // Player 1 joins
      const c1 = new MockPartyClient(room, 'tab1');
      c1.send(JSON.stringify({ type: 'join', playerId: 'refresh_player', matchToken: m1.token }));
      const assignedSeat = room.handler.state.seats.find((s) => s.playerId === 'refresh_player');
      expect(assignedSeat).toBeDefined();
      expect(assignedSeat?.seatIndex).toBe(m1.seatIndex);
      expect(assignedSeat?.isConnected).toBe(true);

      // Player 1 refreshes the browser before the game starts (disconnects and reopens with new connection)
      c1.close();
      expect(assignedSeat?.isConnected).toBe(false);

      // Browser reconnects / refreshes with same token and playerId
      const c1Refreshed = new MockPartyClient(room, 'tab1_refreshed');
      const errors: any[] = [];
      c1Refreshed.addEventListener('message', (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'error') errors.push(msg);
      });

      c1Refreshed.send(JSON.stringify({ type: 'join', playerId: 'refresh_player', matchToken: m1.token }));
      expect(errors).toHaveLength(0);
      const refreshedSeat = room.handler.state.seats.find((s) => s.playerId === 'refresh_player');
      expect(refreshedSeat).toBeDefined();
      expect(refreshedSeat?.seatIndex).toBe(assignedSeat?.seatIndex);
      expect(refreshedSeat?.isConnected).toBe(true);

      cleanup();
    });
  });
});

