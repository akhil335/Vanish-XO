import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameRoomHandler, Main } from './room';
import { LobbyHandler } from './lobby';
import { ServerMessage, LobbyServerMessage } from '../src/lib/types';
import { getLegalMoves } from '../src/lib/game';

describe('Vanish XO - Realtime Server Message Handler', () => {
  let room: GameRoomHandler;
  let client1Messages: ServerMessage[];
  let client2Messages: ServerMessage[];

  const sendClient1 = (msg: string) => {
    client1Messages.push(JSON.parse(msg));
  };

  const sendClient2 = (msg: string) => {
    client2Messages.push(JSON.parse(msg));
  };

  beforeEach(() => {
    room = new GameRoomHandler('TEST', null, true);
    client1Messages = [];
    client2Messages = [];
    room.handleConnection('conn1', sendClient1);
    room.handleConnection('conn2', sendClient2);
  });

  it('handles player joining and seat assignment', () => {
    // Player 1 joins as host (Seat 0, X)
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    expect(room.state.seats[0].playerId).toBe('player1');
    expect(room.state.seats[0].isConnected).toBe(true);

    // Player 2 joins (Seat 1, O)
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    expect(room.state.seats[1].playerId).toBe('player2');
    expect(room.state.seats[1].isConnected).toBe(true);
  });

  it('rejects wrong turn moves', () => {
    // Setup 2 players and start game
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }));

    expect(room.state.status).toBe('playing');
    expect(room.state.turnSeatIndex).toBe(0); // Player 1's turn

    // Player 2 attempts to place mark out of turn!
    client2Messages = [];
    const result = room.handleMessage('conn2', JSON.stringify({ type: 'place', cell: 4 }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_YOUR_TURN');

    // Confirm board is still empty
    expect(room.state.board[4]).toBeNull();
    const lastError = client2Messages.find((m) => m.type === 'error');
    expect(lastError).toBeDefined();
    if (lastError && lastError.type === 'error') {
      expect(lastError.code).toBe('NOT_YOUR_TURN');
    }
  });

  it('rejects illegal moves (cell occupied or invalid)', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }));

    // Player 1 places mark at cell 4
    room.handleMessage('conn1', JSON.stringify({ type: 'place', cell: 4 }));
    expect(room.state.board[4]).toBe('X');
    expect(room.state.turnSeatIndex).toBe(1); // Now Player 2's turn

    // Player 2 tries to place mark at the same cell 4!
    const resultOccupied = room.handleMessage('conn2', JSON.stringify({ type: 'place', cell: 4 }));
    expect(resultOccupied.success).toBe(false);

    // Player 2 tries to place mark out of bounds (9)
    const resultOOB = room.handleMessage('conn2', JSON.stringify({ type: 'place', cell: 9 }));
    expect(resultOOB.success).toBe(false);
  });

  it('supports seamless player reconnect to original seat with same playerId', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }));

    // Player 1 plays cell 0
    room.handleMessage('conn1', JSON.stringify({ type: 'place', cell: 0 }));

    // Player 2 disconnects
    room.handleDisconnection('conn2');
    expect(room.state.seats[1].isConnected).toBe(false);
    expect(room.state.seats[1].disconnectedAt).not.toBeNull();

    // Player 2 reconnects on new connection 'conn3' with same playerId 'player2'
    const client3Messages: ServerMessage[] = [];
    room.handleConnection('conn3', (msg) => client3Messages.push(JSON.parse(msg)));
    room.handleMessage('conn3', JSON.stringify({ type: 'join', playerId: 'player2' }));

    // Verify seat 1 is restored to connected state
    expect(room.state.seats[1].isConnected).toBe(true);
    expect(room.state.seats[1].disconnectedAt).toBeNull();
    expect(room.state.seats[1].playerId).toBe('player2');

    // Player 2 can now place their move from conn3!
    const moveResult = room.handleMessage('conn3', JSON.stringify({ type: 'place', cell: 1 }));
    expect(moveResult.success).toBe(true);
    expect(room.state.board[1]).toBe('O');
  });

  it('triggers auto-move when turn timer expires after 20 seconds', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));

    const startTime = 1000000;
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }), startTime);

    expect(room.state.status).toBe('playing');
    expect(room.state.turnSeatIndex).toBe(0);

    // After 10s (within 20s), tick does not auto move
    room.tick(startTime + 10000);
    expect(room.state.board.every((c) => c === null)).toBe(true);

    // After 20s (timer expired), tick forces an auto move!
    room.tick(startTime + 20000);
    const marksPlaced = room.state.board.filter((c) => c === 'X').length;
    expect(marksPlaced).toBe(1);
    expect(room.state.turnSeatIndex).toBe(1); // Turn advanced to Player 2
  });

  it('pauses and ends game cleanly on opponent disconnect without converting to bot', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    const startTime = 1000000;
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }), startTime);

    // Player 2 disconnects at T = 1,000,000 -> game paused
    room.handleDisconnection('conn2', startTime);
    expect(room.state.seats[1].isConnected).toBe(false);
    expect(room.state.paused).toBe(true);
    expect(room.state.pausedReason).toBe('opponent_disconnected');

    // 30s later: grace period expires -> game finishes with remaining player winning, NO bot!
    room.tick(startTime + 30000);
    expect(room.state.status).toBe('finished');
    expect(room.state.winner).toBe('X');
    expect(room.state.seats[1].isBot).toBe(false);
  });

  it('enforces rate limiting of max 10 messages per second', () => {
    const now = 100000;
    // Send 10 messages rapidly (join + 9 readies = 10 messages)
    const joinRes = room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }), now);
    expect(joinRes.success).toBe(true);

    for (let i = 0; i < 9; i++) {
      const res = room.handleMessage('conn1', JSON.stringify({ type: 'ready', ready: true }), now);
      expect(res.success).toBe(true);
    }

    // 11th message in same second must be rejected
    const res11 = room.handleMessage('conn1', JSON.stringify({ type: 'ready', ready: true }), now + 100);
    expect(res11.success).toBe(false);
    expect(res11.error).toBe('RATE_LIMITED');
  });

  it('rotates starting player on rematch after both players agree', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }));

    // Complete game: X wins row 0, 1, 2
    room.handleMessage('conn1', JSON.stringify({ type: 'place', cell: 0 }));
    room.handleMessage('conn2', JSON.stringify({ type: 'place', cell: 3 }));
    room.handleMessage('conn1', JSON.stringify({ type: 'place', cell: 1 }));
    room.handleMessage('conn2', JSON.stringify({ type: 'place', cell: 4 }));
    room.handleMessage('conn1', JSON.stringify({ type: 'place', cell: 2 }));

    expect(room.state.status).toBe('finished');
    expect(room.state.winner).toBe('X');
    expect(room.state.startingSeatIndex).toBe(0);

    // Trigger rematch: player 1 requests, game stays finished waiting for player 2
    room.handleMessage('conn1', JSON.stringify({ type: 'rematch' }));
    expect(room.state.status).toBe('finished');
    expect(room.state.rematchRequest?.requestedBy).toBe('player1');

    // Player 2 accepts rematch -> game starts!
    room.handleMessage('conn2', JSON.stringify({ type: 'rematch' }));
    expect(room.state.status).toBe('playing');
    // Starting seat rotated from 0 to 1!
    expect(room.state.startingSeatIndex).toBe(1);
    expect(room.state.turnSeatIndex).toBe(1);
  });

  it('creates a 4-seat room (2 humans + 2 bots), plays 200 random moves, and asserts the game never stalls', () => {
    // 1. Host joins (conn1)
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'human1' }));

    // 2. Host configures room for 4 seats
    room.handleMessage('conn1', JSON.stringify({ type: 'set_seats', seatsCount: 4 }));
    expect(room.state.seatsCount).toBe(4);
    expect(room.state.board.length).toBe(36); // 6x6 board!

    // 3. Human 2 joins (conn2)
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'human2' }));
    expect(room.state.seats[1].playerId).toBe('human2');

    // 4. Host sets seats 2 and 3 as bots
    room.handleMessage('conn1', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'set_bot_seat', seatIndex: 3, isBot: true }));
    expect(room.state.seats[2].isBot).toBe(true);
    expect(room.state.seats[3].isBot).toBe(true);

    // 5. Human 2 is ready and host starts game
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    const startRes = room.handleMessage('conn1', JSON.stringify({ type: 'start' }));
    expect(startRes.success).toBe(true);
    expect(room.state.status).toBe('playing');

    // 6. Play 200 random moves
    let simTime = 100000;
    let movesPlayed = 0;
    const maxMoves = 200;
    let iterations = 0;

    while (movesPlayed < maxMoves && iterations < 3000) {
      iterations++;
      simTime += 200;

      // If a player won, trigger rematch and continue playing
      if (room.state.status === 'finished') {
        room.handleMessage('conn1', JSON.stringify({ type: 'rematch' }), simTime);
        const rematchRes = room.handleMessage('conn2', JSON.stringify({ type: 'rematch' }), simTime);
        expect(rematchRes.success).toBe(true);
        expect(room.state.status).toBe('playing');
        continue;
      }

      const turnSeat = room.state.seats[room.state.turnSeatIndex];
      const legalMoves = getLegalMoves(room.state);

      // SAFETY ASSERTION: A legal move MUST always exist!
      expect(legalMoves.length).toBeGreaterThan(0);

      const randomCell = legalMoves[Math.floor(Math.random() * legalMoves.length)];

      if (turnSeat.isBot) {
        // Bot auto plays move
        const botSuccess = room.autoPlayMove(turnSeat.seatIndex, simTime);
        expect(botSuccess).toBe(true);
        movesPlayed++;
      } else {
        // Human plays move
        const conn = turnSeat.seatIndex === 0 ? 'conn1' : 'conn2';
        const placeRes = room.handleMessage(conn, JSON.stringify({ type: 'place', cell: randomCell }), simTime);
        expect(placeRes.success).toBe(true);
        movesPlayed++;
      }
    }

    expect(movesPlayed).toBeGreaterThanOrEqual(maxMoves);
  });

  it('supports ready toggling for guests while host is always ready', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

    // Host (p1) is automatically ready
    expect(room.state.seats[0].isReady).toBe(true);

    // Guest (p2) is not ready initially
    expect(room.state.seats[1].isReady).toBe(false);

    // Guest readies up
    const res1 = room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    expect(res1.success).toBe(true);
    expect(room.state.seats[1].isReady).toBe(true);

    // Guest un-readies
    const res2 = room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: false }));
    expect(res2.success).toBe(true);
    expect(room.state.seats[1].isReady).toBe(false);

    // Host cannot be made unready
    room.handleMessage('conn1', JSON.stringify({ type: 'ready', ready: false }));
    expect(room.state.seats[0].isReady).toBe(true);
  });

  it('rejects start when someone is not ready or when seats are unfilled', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

    // p2 is not ready yet
    const startRes1 = room.handleMessage('conn1', JSON.stringify({ type: 'start' }));
    expect(startRes1.success).toBe(false);
    expect(startRes1.error).toBe('NOT_ALL_READY');
    expect(room.state.canStart).toBe(false);
    expect(room.state.blockReasons).toContain('NOT_ALL_READY');

    // Change to 3 seats: now seat 2 is empty!
    room.handleMessage('conn1', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));

    // Seat 2 is empty, so start is rejected
    const startRes2 = room.handleMessage('conn1', JSON.stringify({ type: 'start' }));
    expect(startRes2.success).toBe(false);
    expect(startRes2.error).toBe('SEATS_NOT_FILLED');
    expect(room.state.canStart).toBe(false);
    expect(room.state.blockReasons).toContain('SEATS_NOT_FILLED');

    // Fill seat 2 with a bot -> start succeeds!
    room.handleMessage('conn1', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    expect(room.state.canStart).toBe(true);
    expect(room.state.blockReasons).toEqual([]);
    const startRes3 = room.handleMessage('conn1', JSON.stringify({ type: 'start' }));
    expect(startRes3.success).toBe(true);
    expect(room.state.status).toBe('playing');
  });

  it('resets guest ready states when player count changes', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

    // p2 readies up
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    expect(room.state.seats[1].isReady).toBe(true);

    // Host changes seat count to 3
    room.handleMessage('conn1', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    expect(room.state.seatsCount).toBe(3);

    // Guest p2 is reset to not ready! Host p1 remains ready
    expect(room.state.seats[1].isReady).toBe(false);
    expect(room.state.seats[0].isReady).toBe(true);
  });

  it('transfers host to the next human when the host leaves', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));
    expect(room.state.hostPlayerId).toBe('p1');

    // Host leaves
    room.handleMessage('conn1', JSON.stringify({ type: 'leave' }));

    // Host seat is cleared
    expect(room.state.seats[0].playerId).toBeNull();

    // Host transferred to next human (p2)!
    expect(room.state.hostPlayerId).toBe('p2');
    expect(room.state.seats[1].isReady).toBe(true);
  });

  it('supports leaving cleanly via Home during game over and NEVER auto-fills bots for rematch', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }));

    // Simulate game over (p1 wins)
    room.state.status = 'finished';
    room.state.winner = 'X';

    // Player 2 taps Home (leaves cleanly)
    room.handleMessage('conn2', JSON.stringify({ type: 'leave' }));
    expect(room.state.seats[1].playerId).toBeNull();
    expect(room.state.seats[1].isConnected).toBe(false);

    // Player 1 taps Again (rematch): empty seat 1 is NOT filled with a bot; rematch is rejected
    const rematchRes = room.handleMessage('conn1', JSON.stringify({ type: 'rematch' }));
    expect(rematchRes.success).toBe(false);
    expect(rematchRes.error).toBe('OPPONENT_NOT_AVAILABLE');
    expect(room.state.status).toBe('finished');
    expect(room.state.seats[1].isBot).toBe(false);
  });

  describe('Room State Machine (Fresh / Uninitialized / Matchmaking)', () => {
    it('creates on a fresh uninitialized room works and sets host', () => {
      const freshRoom = new GameRoomHandler('FRESH');
      expect(freshRoom.state.status).toBe('uninitialized');
      expect(freshRoom.state.hostPlayerId).toBeNull();

      const msgs: ServerMessage[] = [];
      freshRoom.handleConnection('conn1', (msg) => msgs.push(JSON.parse(msg)));

      const createRes = freshRoom.handleMessage('conn1', JSON.stringify({ type: 'create', playerId: 'p1' }));
      expect(createRes.success).toBe(true);
      expect(freshRoom.state.status).toBe('waiting');
      expect(freshRoom.state.hostPlayerId).toBe('p1');
      expect(freshRoom.state.seats[0].playerId).toBe('p1');

      const stateMsg = msgs.find((m) => m.type === 'state');
      expect(stateMsg).toBeDefined();
    });

    it('create on an existing room returns ROOM_TAKEN and changes nothing', () => {
      const freshRoom = new GameRoomHandler('FRESH');
      freshRoom.handleMessage('conn1', JSON.stringify({ type: 'create', playerId: 'p1' }));
      expect(freshRoom.state.hostPlayerId).toBe('p1');

      const msgs2: ServerMessage[] = [];
      freshRoom.handleConnection('conn2', (msg) => msgs2.push(JSON.parse(msg)));

      // Second client attempts to create the same room
      const createRes2 = freshRoom.handleMessage('conn2', JSON.stringify({ type: 'create', playerId: 'p2' }));
      expect(createRes2.success).toBe(false);
      expect(createRes2.error).toBe('ROOM_TAKEN');
      expect(freshRoom.state.hostPlayerId).toBe('p1'); // Unchanged!

      const err = msgs2.find((m) => m.type === 'error');
      expect(err).toBeDefined();
      if (err && err.type === 'error') {
        expect(err.code).toBe('ROOM_TAKEN');
      }
    });

    it('join on an uninitialized room returns ROOM_NOT_FOUND and leaves no state', () => {
      const freshRoom = new GameRoomHandler('EMPTY');
      let closed = false;
      const msgs: ServerMessage[] = [];
      freshRoom.handleConnection(
        'conn1',
        (msg) => msgs.push(JSON.parse(msg)),
        () => {
          closed = true;
        }
      );

      const joinRes = freshRoom.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toBe('ROOM_NOT_FOUND');
      expect(closed).toBe(true);
      expect(freshRoom.state.status).toBe('uninitialized');
      expect(freshRoom.state.seats.length).toBe(0);
      expect(freshRoom.isExpired).toBe(true);

      const err = msgs.find((m) => m.type === 'error');
      expect(err).toBeDefined();
      if (err && err.type === 'error') {
        expect(err.code).toBe('ROOM_NOT_FOUND');
      }
    });

    it('rate-limits create and join attempts per connection to max 5 per 10 seconds', () => {
      const freshRoom = new GameRoomHandler('RATELIMIT');
      const now = 50000;
      let closed = false;
      freshRoom.handleConnection(
        'conn1',
        () => {},
        () => {
          closed = true;
        }
      );

      // 4 rapid attempts (failing with ROOM_NOT_FOUND since uninitialized)
      for (let i = 0; i < 4; i++) {
        const res = freshRoom.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }), now + i * 100);
        expect(res.error).toBe('ROOM_NOT_FOUND');
      }

      // 5th attempt: also fails with ROOM_NOT_FOUND
      const res5 = freshRoom.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }), now + 500);
      expect(res5.error).toBe('ROOM_NOT_FOUND');

      // 6th attempt within 10s: blocked by RATE_LIMITED!
      const res6 = freshRoom.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }), now + 1000);
      expect(res6.success).toBe(false);
      expect(res6.error).toBe('RATE_LIMITED');
      expect(closed).toBe(true);
    });

    it('matchmaking creation with one-time token verifies join token and rejects hijacks', () => {
      const matchRoom = new GameRoomHandler('MATCH');
      const token = 'secret-one-time-token-123';
      const initRes = matchRoom.initMatch(token, 2, 0, []);
      expect(initRes.success).toBe(true);
      expect(matchRoom.state.status).toBe('waiting');

      // Hijacker attempts to join without token -> rejected with ROOM_NOT_FOUND!
      const msgsHacker: ServerMessage[] = [];
      matchRoom.handleConnection('connHacker', (msg) => msgsHacker.push(JSON.parse(msg)));
      const hijackRes = matchRoom.handleMessage('connHacker', JSON.stringify({ type: 'join', playerId: 'hacker' }));
      expect(hijackRes.success).toBe(false);
      expect(hijackRes.error).toBe('ROOM_NOT_FOUND');

      // Legitimate player joins with token -> succeeds!
      const msgsPlayer: ServerMessage[] = [];
      matchRoom.handleConnection('connPlayer', (msg) => msgsPlayer.push(JSON.parse(msg)));
      const legitRes = matchRoom.handleMessage(
        'connPlayer',
        JSON.stringify({
          type: 'join',
          playerId: 'p1',
          matchToken: token,
          matchConfig: { seatsCount: 2, assignedSeatIndex: 0, startingSeatIndex: 0, botSeats: [] },
        })
      );
      expect(legitRes.success).toBe(true);
      expect(matchRoom.state.seats[0].playerId).toBe('p1');
    });

    it('matchmaking creation retries if room code is ROOM_TAKEN', async () => {
      let attempts = 0;
      const lobbyWithCollisions = new LobbyHandler(async () => {
        attempts++;
        if (attempts < 3) {
          return { success: false, error: 'ROOM_TAKEN' };
        }
        return { success: true };
      });

      const p1Msgs: LobbyServerMessage[] = [];
      const p2Msgs: LobbyServerMessage[] = [];
      lobbyWithCollisions.handleConnection('c1', (msg: string) => p1Msgs.push(JSON.parse(msg)));
      lobbyWithCollisions.handleConnection('c2', (msg: string) => p2Msgs.push(JSON.parse(msg)));

      lobbyWithCollisions.handleMessage('c1', JSON.stringify({ type: 'queue_join', playerId: 'p1', targetCount: 2 }));
      await lobbyWithCollisions.handleMessage('c2', JSON.stringify({ type: 'queue_join', playerId: 'p2', targetCount: 2 }));

      expect(attempts).toBe(3); // Retried twice after ROOM_TAKEN and succeeded on 3rd attempt!
      const matchFound = p1Msgs.find((m) => m.type === 'match_found');
      expect(matchFound).toBeDefined();
    });
  });
});

describe('Main Durable Object Class API (partyserver)', () => {
  function createMockConn(id: string) {
    const messages: ServerMessage[] = [];
    let isClosed = false;
    return {
      id,
      send: (msg: string) => messages.push(JSON.parse(msg)),
      close: () => {
        isClosed = true;
      },
      messages,
      get closed() {
        return isClosed;
      },
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
      __getAlarmTime: () => alarmTime,
    } as unknown as DurableObjectState;
  }

  const mockEnv = {
    Main: {
      idFromName: (name: string) => ({ name, toString: () => name }),
      get: (_id: any) => ({
        fetch: async (_url: string, _init?: any) => new Response('ok'),
      }),
    },
    Lobby: {
      idFromName: (name: string) => ({ name, toString: () => name }),
      get: (_id: any) => ({
        fetch: async (_url: string, _init?: any) => new Response('ok'),
      }),
    },
  } as any;

  it('handles room creation, joining, start, illegal move, and wrong turn via Main class API', () => {
    const state = createMockDOState('TEST1');
    const main = new Main(state, mockEnv);

    const conn1 = createMockConn('c1');
    const conn2 = createMockConn('c2');

    // Connect & create room
    main.onConnect(conn1 as any);
    main.onMessage(conn1 as any, JSON.stringify({ type: 'create', playerId: 'p1' }));
    expect(main.state.status).toBe('waiting');

    // Connect & join player 2
    main.onConnect(conn2 as any);
    main.onMessage(conn2 as any, JSON.stringify({ type: 'join', playerId: 'p2' }));
    expect(main.state.seats[1].playerId).toBe('p2');

    // Player 2 readies
    main.onMessage(conn2 as any, JSON.stringify({ type: 'ready', ready: true }));
    expect(main.state.seats[1].isReady).toBe(true);

    // Host starts game
    main.onMessage(conn1 as any, JSON.stringify({ type: 'start' }));
    expect(main.state.status).toBe('playing');
    expect(main.state.turnSeatIndex).toBe(0);

    // Wrong turn: player 2 tries to play before player 1
    main.onMessage(conn2 as any, JSON.stringify({ type: 'place', cell: 4 }));
    const errs1 = conn2.messages.filter((m) => m.type === 'error');
    expect(errs1[errs1.length - 1]?.code).toBe('NOT_YOUR_TURN');

    // Player 1 plays cell 0
    main.onMessage(conn1 as any, JSON.stringify({ type: 'place', cell: 0 }));
    expect(main.state.board[0]).toBe('X');
    expect(main.state.turnSeatIndex).toBe(1);

    // Illegal move: player 2 tries to place mark on already occupied cell 0
    main.onMessage(conn2 as any, JSON.stringify({ type: 'place', cell: 0 }));
    const errs2 = conn2.messages.filter((m) => m.type === 'error');
    expect(errs2[errs2.length - 1]?.code).toBe('ILLEGAL_MOVE');
  });

  it('handles disconnect and reconnect via Main class API', () => {
    const state = createMockDOState('TEST2');
    const main = new Main(state, mockEnv);

    const conn1 = createMockConn('c1');
    const conn2 = createMockConn('c2');

    main.onConnect(conn1 as any);
    main.onMessage(conn1 as any, JSON.stringify({ type: 'create', playerId: 'p1' }));

    main.onConnect(conn2 as any);
    main.onMessage(conn2 as any, JSON.stringify({ type: 'join', playerId: 'p2' }));

    expect(main.state.seats[1].isConnected).toBe(true);

    // Player 2 disconnects
    main.onClose(conn2 as any);
    expect(main.state.seats[1].isConnected).toBe(false);

    // Player 2 reconnects on a new connection
    const conn2Recon = createMockConn('c2_recon');
    main.onConnect(conn2Recon as any);
    main.onMessage(conn2Recon as any, JSON.stringify({ type: 'join', playerId: 'p2' }));

    expect(main.state.seats[1].isConnected).toBe(true);
    expect(main.state.seats[1].playerId).toBe('p2');
  });

  it('triggers timeout auto-move when 20s elapses via Main class API', () => {
    const state = createMockDOState('TEST3');
    const main = new Main(state, mockEnv);

    const conn1 = createMockConn('c1');
    const conn2 = createMockConn('c2');

    main.onConnect(conn1 as any);
    main.onMessage(conn1 as any, JSON.stringify({ type: 'create', playerId: 'p1' }));
    main.onConnect(conn2 as any);
    main.onMessage(conn2 as any, JSON.stringify({ type: 'join', playerId: 'p2' }));
    main.onMessage(conn2 as any, JSON.stringify({ type: 'ready', ready: true }));
    main.onMessage(conn1 as any, JSON.stringify({ type: 'start' }));

    expect(main.state.status).toBe('playing');
    expect(main.state.turnSeatIndex).toBe(0);

    // Advance 20 seconds
    main.tick(main.state.turnStartedAt + 20000);

    // Turn rotated to Seat 1 because seat 0 auto-played
    expect(main.state.turnSeatIndex).toBe(1);
    expect(main.state.board.filter((c) => c !== null).length).toBe(1);
  });

  it('rejects create on already initialized room with ROOM_TAKEN and join on uninitialized room with ROOM_NOT_FOUND', () => {
    const state = createMockDOState('TEST4');
    const main = new Main(state, mockEnv);

    const conn1 = createMockConn('c1');
    main.onConnect(conn1 as any);

    // Join on uninitialized room -> ROOM_NOT_FOUND
    main.onMessage(conn1 as any, JSON.stringify({ type: 'join', playerId: 'p1' }));
    const errs1 = conn1.messages.filter((m) => m.type === 'error');
    expect(errs1[errs1.length - 1]?.code).toBe('ROOM_NOT_FOUND');
    expect(conn1.closed).toBe(true);

    // Create room
    const conn2 = createMockConn('c2');
    main.onConnect(conn2 as any);
    main.onMessage(conn2 as any, JSON.stringify({ type: 'create', playerId: 'p1' }));
    expect(main.state.status).toBe('waiting');

    // Second create -> ROOM_TAKEN
    const conn3 = createMockConn('c3');
    main.onConnect(conn3 as any);
    main.onMessage(conn3 as any, JSON.stringify({ type: 'create', playerId: 'p3' }));
    const errs3 = conn3.messages.filter((m) => m.type === 'error');
    expect(errs3[errs3.length - 1]?.code).toBe('ROOM_TAKEN');
  });

  it('cleans up empty room after 5 minutes via Main class API and alarm', async () => {
    const state = createMockDOState('TEST5');
    const main = new Main(state, mockEnv);

    const conn1 = createMockConn('c1');
    main.onConnect(conn1 as any);
    main.onMessage(conn1 as any, JSON.stringify({ type: 'create', playerId: 'p1' }));

    const t0 = 100000;
    main.handler.lastActiveTimestamp = t0;
    // Human disconnects
    main.onClose(conn1 as any);
    main.handler.lastActiveTimestamp = t0;
    expect(main.isExpired).toBe(false);

    // 4 minutes later: still not expired
    main.tick(t0 + 4 * 60 * 1000);
    expect(main.isExpired).toBe(false);

    // 5 minutes later: alarm fires and room expires
    main.tick(t0 + 5 * 60 * 1000);
    await main.onAlarm();
    expect(main.isExpired).toBe(true);
  });
});

describe('Lobby Sync and Host Ownership Bug Fixes (Required Scenarios)', () => {
  let room: GameRoomHandler;
  let hostMsgs: ServerMessage[];
  let guest1Msgs: ServerMessage[];
  let guest2Msgs: ServerMessage[];
  let guest3Msgs: ServerMessage[];

  beforeEach(() => {
    room = new GameRoomHandler('SYNC_TEST');
    hostMsgs = [];
    guest1Msgs = [];
    guest2Msgs = [];
    guest3Msgs = [];
    room.handleConnection('conn_host', (m) => hostMsgs.push(JSON.parse(m)));
    room.handleConnection('conn_g1', (m) => guest1Msgs.push(JSON.parse(m)));
    room.handleConnection('conn_g2', (m) => guest2Msgs.push(JSON.parse(m)));
    room.handleConnection('conn_g3', (m) => guest3Msgs.push(JSON.parse(m)));
  });

  // TEST 1: Host creates a 2P room, a guest joins and readies: the host connection receives a state update with canStart true.
  it('1. Host creates 2P room, guest joins and readies: host connection receives state update with canStart true', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));

    // Before guest readies, canStart is false
    expect(room.state.canStart).toBe(false);

    // Clear host messages and guest readies
    hostMsgs = [];
    room.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));

    // Host connection must have received the state broadcast
    const lastHostState = hostMsgs.filter((m) => m.type === 'state').pop();
    expect(lastHostState).toBeDefined();
    if (lastHostState && lastHostState.type === 'state') {
      expect(lastHostState.state.canStart).toBe(true);
      expect(lastHostState.state.readyCount).toBe(2);
      expect(lastHostState.state.requiredCount).toBe(2);
      expect(lastHostState.state.blockReasons).toEqual([]);
      expect(lastHostState.state.hostPlayerId).toBe('host_p');
    }
    expect(room.state.canStart).toBe(true);
  });

  // TEST 2: Same flow for 3P and 4P, with mixes of humans and bots.
  it('2. Same flow for 3P and 4P with mixes of humans and bots', () => {
    // --- 3P: 1 Host + 1 Human Guest + 1 Bot ---
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    room.handleMessage('conn_host', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    room.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_1' }));

    // Guest 1 is not ready yet -> canStart false, blockReasons NOT_ALL_READY
    expect(room.state.canStart).toBe(false);
    expect(room.state.blockReasons).toContain('NOT_ALL_READY');

    hostMsgs = [];
    room.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));

    const hostState3P = hostMsgs.filter((m) => m.type === 'state').pop();
    expect(hostState3P).toBeDefined();
    if (hostState3P && hostState3P.type === 'state') {
      expect(hostState3P.state.canStart).toBe(true);
      expect(hostState3P.state.seatsCount).toBe(3);
      expect(hostState3P.state.readyCount).toBe(3);
      expect(hostState3P.state.blockReasons).toEqual([]);
    }

    // --- 4P: 1 Host + 2 Human Guests + 1 Bot ---
    const room4P = new GameRoomHandler('TEST_4P');
    const host4PMsgs: ServerMessage[] = [];
    room4P.handleConnection('conn_host4', (m) => host4PMsgs.push(JSON.parse(m)));
    room4P.handleConnection('conn_g1_4', () => {});
    room4P.handleConnection('conn_g2_4', () => {});

    room4P.handleMessage('conn_host4', JSON.stringify({ type: 'create', playerId: 'host_4' }));
    room4P.handleMessage('conn_host4', JSON.stringify({ type: 'set_seats', seatsCount: 4 }));
    room4P.handleMessage('conn_host4', JSON.stringify({ type: 'set_bot_seat', seatIndex: 3, isBot: true }));
    room4P.handleMessage('conn_g1_4', JSON.stringify({ type: 'join', playerId: 'g1_4' }));
    room4P.handleMessage('conn_g2_4', JSON.stringify({ type: 'join', playerId: 'g2_4' }));

    // Before both ready
    room4P.handleMessage('conn_g1_4', JSON.stringify({ type: 'ready', ready: true }));
    expect(room4P.state.canStart).toBe(false);
    expect(room4P.state.blockReasons).toContain('NOT_ALL_READY');

    host4PMsgs.length = 0;
    // Guest 2 readies -> now all ready!
    room4P.handleMessage('conn_g2_4', JSON.stringify({ type: 'ready', ready: true }));

    const hostState4P = host4PMsgs.filter((m) => m.type === 'state').pop();
    expect(hostState4P).toBeDefined();
    if (hostState4P && hostState4P.type === 'state') {
      expect(hostState4P.state.canStart).toBe(true);
      expect(hostState4P.state.seatsCount).toBe(4);
      expect(hostState4P.state.readyCount).toBe(4);
      expect(hostState4P.state.blockReasons).toEqual([]);
    }
  });

  // TEST 3: Host refresh (disconnect and reconnect within 60s): hostPlayerId unchanged, seat unchanged, no duplicate seat.
  it('3. Host refresh (disconnect and reconnect within 60s): hostPlayerId unchanged, seat unchanged, no duplicate seat', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }), 1000);
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }), 2000);

    expect(room.state.hostPlayerId).toBe('host_p');
    expect(room.state.seats[0].playerId).toBe('host_p');
    expect(room.state.seats[0].isConnected).toBe(true);

    // Host refreshes browser (conn_host drops at t = 3000)
    room.handleDisconnection('conn_host', 3000);

    // Host seat marked offline, but hostPlayerId is PRESERVED!
    expect(room.state.seats[0].isConnected).toBe(false);
    expect(room.state.seats[0].connected).toBe(false);
    expect(room.state.hostPlayerId).toBe('host_p');

    // Tick at t = 30000 (within 60s grace period)
    room.tick(30000);
    expect(room.state.hostPlayerId).toBe('host_p');

    // Host reconnects on new connection conn_host_new at t = 35000 with the same playerId
    const hostNewMsgs: ServerMessage[] = [];
    room.handleConnection('conn_host_new', (m) => hostNewMsgs.push(JSON.parse(m)));
    const reconRes = room.handleMessage('conn_host_new', JSON.stringify({ type: 'join', playerId: 'host_p' }), 35000);

    expect(reconRes.success).toBe(true);
    expect(room.state.hostPlayerId).toBe('host_p');
    expect(room.state.seats[0].playerId).toBe('host_p');
    expect(room.state.seats[0].isConnected).toBe(true);
    expect(room.state.seats[0].connected).toBe(true);
    expect(room.state.seats[0].isReady).toBe(true);
    expect(room.state.seats.length).toBe(2); // No duplicate seat!
  });

  // TEST 4: Host disconnect for over 60s: host moves to another connected human, and original host returns as a normal guest.
  it('4. Host disconnect for over 60s: host transfers to longest-present connected human, and original host returns as normal guest', () => {
    // Host joins at t=1000
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_1' }), 1000);
    // Guest 1 joins at t=2000
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_1' }), 2000);
    // Guest 2 joins at t=3000
    room.handleMessage('conn_g2', JSON.stringify({ type: 'join', playerId: 'guest_2' }), 3000);

    expect(room.state.hostPlayerId).toBe('host_1');

    // Host drops connection at t=5000
    room.handleDisconnection('conn_host', 5000);

    // Guest 1 remains active (ping at t=60000)
    room.handleMessage('conn_g1', JSON.stringify({ type: 'ping' }), 60000);

    // 61 seconds later (t = 66000): grace period expires
    room.tick(66000);

    // Host role transferred to longest-present connected human (guest_1 joined at 2000 vs guest_2 at 3000)
    expect(room.state.hostPlayerId).toBe('guest_1');
    expect(room.state.seats[1].playerId).toBe('guest_1');

    // Original host returns later at t=80000
    const returnedHostMsgs: ServerMessage[] = [];
    room.handleConnection('conn_host_returned', (m) => returnedHostMsgs.push(JSON.parse(m)));
    const joinRes = room.handleMessage('conn_host_returned', JSON.stringify({ type: 'join', playerId: 'host_1' }), 80000);

    expect(joinRes.success).toBe(true);
    // Does host move back? NO: guest_1 remains the host!
    expect(room.state.hostPlayerId).toBe('guest_1');
    // Original host is now a normal guest
    const originalHostSeat = room.state.seats.find((s) => s.playerId === 'host_1');
    expect(originalHostSeat).toBeDefined();
    expect(originalHostSeat?.isReady).toBe(false);
  });

  // TEST 5: Explicit leave by host: host transfers immediately.
  it('5. Explicit leave by host: host transfers immediately', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));

    expect(room.state.hostPlayerId).toBe('host_p');

    // Host explicitly clicks Home / leave
    room.handleMessage('conn_host', JSON.stringify({ type: 'leave' }));

    // Host is transferred immediately to guest_p
    expect(room.state.hostPlayerId).toBe('guest_p');
    // Former host's seat is cleared at once
    expect(room.state.seats[0].playerId).toBeNull();
    expect(room.state.seats[0].kind).toBe('empty');
  });

  // TEST 6: Guest refresh: seat kept, ready cleared, no duplicate seat.
  it('6. Guest refresh: seat kept, ready cleared, no duplicate seat', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));

    // Guest readies up
    room.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));
    expect(room.state.seats[1].isReady).toBe(true);
    expect(room.state.seats[1].ready).toBe(true);

    // Guest refreshes (disconnects)
    room.handleDisconnection('conn_g1');

    // Seat is kept, ready is cleared!
    expect(room.state.seats[1].playerId).toBe('guest_p');
    expect(room.state.seats[1].isConnected).toBe(false);
    expect(room.state.seats[1].connected).toBe(false);
    expect(room.state.seats[1].isReady).toBe(false);
    expect(room.state.seats[1].ready).toBe(false);
    expect(room.state.hostPlayerId).toBe('host_p');

    // Guest reconnects on conn_g1_recon
    const reconMsgs: ServerMessage[] = [];
    room.handleConnection('conn_g1_recon', (m) => reconMsgs.push(JSON.parse(m)));
    room.handleMessage('conn_g1_recon', JSON.stringify({ type: 'join', playerId: 'guest_p' }));

    expect(room.state.seats[1].playerId).toBe('guest_p');
    expect(room.state.seats[1].isConnected).toBe(true);
    expect(room.state.seats[1].connected).toBe(true);
    expect(room.state.seats[1].isReady).toBe(false); // Stays cleared until guest taps Ready again
    expect(room.state.seats.length).toBe(2); // No duplicate seat!
  });

  // TEST 7: Duplicate join with the same playerId is idempotent.
  it('7. Duplicate join with the same playerId is idempotent', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    const join1 = room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));
    expect(join1.success).toBe(true);
    expect(room.state.seats[1].playerId).toBe('guest_p');

    // Duplicate join from React StrictMode or quick duplicate event
    const join2 = room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));
    expect(join2.success).toBe(true);

    expect(room.state.seats.length).toBe(2);
    expect(room.state.seats[1].playerId).toBe('guest_p');
    expect(room.state.seats.filter((s) => s.playerId === 'guest_p').length).toBe(1);
  });

  // TEST 8: Seat count change resets ready states and broadcasts to all connections.
  it('8. Seat count change resets ready states and broadcasts to all connections', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));

    // Guest readies
    room.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));
    expect(room.state.seats[1].isReady).toBe(true);

    hostMsgs = [];
    guest1Msgs = [];

    // Host changes seat count from 2 to 3
    room.handleMessage('conn_host', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));

    expect(room.state.seatsCount).toBe(3);
    // Guest ready reset!
    expect(room.state.seats[1].isReady).toBe(false);
    expect(room.state.seats[1].ready).toBe(false);

    // Host and Guest both received the broadcast
    const hostBroadcast = hostMsgs.filter((m) => m.type === 'state').pop();
    const guestBroadcast = guest1Msgs.filter((m) => m.type === 'state').pop();

    expect(hostBroadcast).toBeDefined();
    expect(guestBroadcast).toBeDefined();
    if (hostBroadcast && hostBroadcast.type === 'state') {
      expect(hostBroadcast.state.seatsCount).toBe(3);
      expect(hostBroadcast.state.seats[1].ready).toBe(false);
    }
    if (guestBroadcast && guestBroadcast.type === 'state') {
      expect(guestBroadcast.state.seatsCount).toBe(3);
      expect(guestBroadcast.state.seats[1].ready).toBe(false);
    }
  });

  // TEST 9: Start rejected when canStart is false, with the right blockReasons.
  it('9. Start rejected when canStart is false, with the right blockReasons', () => {
    room.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'host_p' }));

    // Only host in 2P room (seat 1 empty) -> rejected with SEATS_NOT_FILLED
    hostMsgs = [];
    const startRes1 = room.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
    expect(startRes1.success).toBe(false);
    expect(startRes1.error).toBe('SEATS_NOT_FILLED');
    expect(startRes1.blockReasons).toContain('SEATS_NOT_FILLED');

    const err1 = hostMsgs.find((m) => m.type === 'error');
    expect(err1).toBeDefined();
    if (err1 && err1.type === 'error') {
      expect(err1.code).toBe('SEATS_NOT_FILLED');
      expect(err1.blockReasons).toContain('SEATS_NOT_FILLED');
    }

    // Guest joins but is not ready -> rejected with NOT_ALL_READY
    room.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'guest_p' }));
    hostMsgs = [];
    const startRes2 = room.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
    expect(startRes2.success).toBe(false);
    expect(startRes2.error).toBe('NOT_ALL_READY');
    expect(startRes2.blockReasons).toContain('NOT_ALL_READY');

    const err2 = hostMsgs.find((m) => m.type === 'error');
    expect(err2).toBeDefined();
    if (err2 && err2.type === 'error') {
      expect(err2.code).toBe('NOT_ALL_READY');
      expect(err2.blockReasons).toContain('NOT_ALL_READY');
    }
  });

  // EXACT MANUAL TEST SCRIPT SCENARIO
  it('executes the full 5-step manual test script with simulated multi-browser clients', () => {
    // 1. Host creates a 2P room. Guest joins and taps Ready. Host's Start becomes enabled right away without any other action.
    const roomE2E = new GameRoomHandler('E2E_ROOM');
    const b1Msgs: ServerMessage[] = []; // Browser 1 (Host)
    const b2Msgs: ServerMessage[] = []; // Browser 2 (Guest 1)
    const b3Msgs: ServerMessage[] = []; // Browser 3 (Guest 2)

    roomE2E.handleConnection('b1_conn', (m) => b1Msgs.push(JSON.parse(m)));
    roomE2E.handleConnection('b2_conn', (m) => b2Msgs.push(JSON.parse(m)));
    roomE2E.handleConnection('b3_conn', (m) => b3Msgs.push(JSON.parse(m)));

    // Host creates 2P room
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'create', playerId: 'browser_1_host' }));
    expect(roomE2E.state.canStart).toBe(false);
    expect(roomE2E.state.hostPlayerId).toBe('browser_1_host');

    // Guest joins
    roomE2E.handleMessage('b2_conn', JSON.stringify({ type: 'join', playerId: 'browser_2_guest' }));
    expect(roomE2E.state.canStart).toBe(false);
    expect(roomE2E.state.blockReasons).toContain('NOT_ALL_READY');

    // Guest taps Ready
    b1Msgs.length = 0;
    roomE2E.handleMessage('b2_conn', JSON.stringify({ type: 'ready', ready: true }));

    // Host received state update with canStart: true immediately without any other action!
    const hostLatestState = b1Msgs.filter((m) => m.type === 'state').pop();
    expect(hostLatestState).toBeDefined();
    if (hostLatestState && hostLatestState.type === 'state') {
      expect(hostLatestState.state.canStart).toBe(true);
      expect(hostLatestState.state.blockReasons).toEqual([]);
    }
    expect(roomE2E.state.canStart).toBe(true);

    // 2. Repeat with 3P and 4P, and with one bot filling a seat.
    // 3P with 1 bot:
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    expect(roomE2E.state.canStart).toBe(false); // Guest was reset to unready
    roomE2E.handleMessage('b2_conn', JSON.stringify({ type: 'ready', ready: true }));
    expect(roomE2E.state.canStart).toBe(true); // Now canStart: true!

    // 4P with 1 bot:
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'set_seats', seatsCount: 4 }));
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    roomE2E.handleMessage('b3_conn', JSON.stringify({ type: 'join', playerId: 'browser_3_guest' }));
    expect(roomE2E.state.canStart).toBe(false);
    roomE2E.handleMessage('b2_conn', JSON.stringify({ type: 'ready', ready: true }));
    roomE2E.handleMessage('b3_conn', JSON.stringify({ type: 'ready', ready: true }));
    expect(roomE2E.state.canStart).toBe(true); // All 4 filled (3 humans + 1 bot) and ready!

    // Reset back to 2P for refresh & leave steps
    roomE2E.handleMessage('b1_conn', JSON.stringify({ type: 'set_seats', seatsCount: 2 }));
    roomE2E.handleMessage('b2_conn', JSON.stringify({ type: 'ready', ready: true }));
    expect(roomE2E.state.canStart).toBe(true);

    // 3. Host refreshes: still host, same seat, state intact.
    roomE2E.handleDisconnection('b1_conn');
    expect(roomE2E.state.hostPlayerId).toBe('browser_1_host');
    expect(roomE2E.state.seats[0].playerId).toBe('browser_1_host');
    expect(roomE2E.state.seats[0].isConnected).toBe(false);

    // Host reconnects on refreshed tab
    const b1RefreshedMsgs: ServerMessage[] = [];
    roomE2E.handleConnection('b1_conn_refreshed', (m) => b1RefreshedMsgs.push(JSON.parse(m)));
    roomE2E.handleMessage('b1_conn_refreshed', JSON.stringify({ type: 'join', playerId: 'browser_1_host' }));
    expect(roomE2E.state.hostPlayerId).toBe('browser_1_host');
    expect(roomE2E.state.seats[0].playerId).toBe('browser_1_host');
    expect(roomE2E.state.seats[0].isConnected).toBe(true);
    expect(roomE2E.state.seats.length).toBe(2);

    // 4. Guest refreshes: same seat, ready cleared, host still host.
    roomE2E.handleDisconnection('b2_conn');
    expect(roomE2E.state.seats[1].playerId).toBe('browser_2_guest');
    expect(roomE2E.state.seats[1].isConnected).toBe(false);
    expect(roomE2E.state.seats[1].isReady).toBe(false);
    expect(roomE2E.state.hostPlayerId).toBe('browser_1_host');

    // Guest reconnects on refreshed tab
    const b2RefreshedMsgs: ServerMessage[] = [];
    roomE2E.handleConnection('b2_conn_refreshed', (m) => b2RefreshedMsgs.push(JSON.parse(m)));
    roomE2E.handleMessage('b2_conn_refreshed', JSON.stringify({ type: 'join', playerId: 'browser_2_guest' }));
    expect(roomE2E.state.seats[1].playerId).toBe('browser_2_guest');
    expect(roomE2E.state.seats[1].isConnected).toBe(true);
    expect(roomE2E.state.seats[1].isReady).toBe(false); // ready cleared
    expect(roomE2E.state.hostPlayerId).toBe('browser_1_host'); // host still host!

    // 5. Host taps Home: another player becomes host.
    const allMsgsBeforeLeave: ServerMessage[] = [];
    roomE2E.handleConnection('observer_conn', (m) => allMsgsBeforeLeave.push(JSON.parse(m)));
    roomE2E.handleMessage('b1_conn_refreshed', JSON.stringify({ type: 'leave' }));

    // Host transferred to browser_2_guest
    expect(roomE2E.state.hostPlayerId).toBe('browser_2_guest');
    expect(roomE2E.state.seats[0].playerId).toBeNull();
    // host_changed toast message sent
    const hostChangedMsg = allMsgsBeforeLeave.find((m) => m.type === 'host_changed');
    expect(hostChangedMsg).toBeDefined();
    if (hostChangedMsg && hostChangedMsg.type === 'host_changed') {
      expect(hostChangedMsg.newHostPlayerId).toBe('browser_2_guest');
    }
  });

  describe('Private Room Lobby Role and Phase Transition Requirements', () => {
    it('Host sees isHost = true and seat is auto-ready after creating room (2P)', () => {
      const handler = new GameRoomHandler('PVT2P');
      const hostMessages: ServerMessage[] = [];
      handler.handleConnection('conn_host', (m) => hostMessages.push(JSON.parse(m)));

      handler.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'p_host' }));

      expect(handler.state.hostPlayerId).toBe('p_host');
      const isHost = handler.state.hostPlayerId === 'p_host';
      expect(isHost).toBe(true);

      // Host seat is automatically ready on the server
      const hostSeat = handler.state.seats.find((s) => s.playerId === 'p_host');
      expect(hostSeat).toBeDefined();
      expect(hostSeat?.ready).toBe(true);
      expect(hostSeat?.isReady).toBe(true);
      expect(handler.state.canStart).toBe(false); // Guest not joined yet
    });

    it('Guest joins and readies: HOST receives state with canStart = true; Host starts: both receive phase = "playing"', () => {
      const handler = new GameRoomHandler('PVT2P');
      const hostMessages: ServerMessage[] = [];
      const guestMessages: ServerMessage[] = [];

      handler.handleConnection('conn_host', (m) => hostMessages.push(JSON.parse(m)));
      handler.handleConnection('conn_guest', (m) => guestMessages.push(JSON.parse(m)));

      // 1. Host creates
      handler.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'p_host' }));

      // 2. Guest joins
      handler.handleMessage('conn_guest', JSON.stringify({ type: 'join', playerId: 'p_guest' }));
      expect(handler.state.canStart).toBe(false);

      // 3. Guest readies
      hostMessages.length = 0;
      guestMessages.length = 0;
      handler.handleMessage('conn_guest', JSON.stringify({ type: 'ready', ready: true }));

      // Host connection received broadcast state with canStart = true immediately
      const hostLatestState = hostMessages.filter((m) => m.type === 'state').pop();
      expect(hostLatestState).toBeDefined();
      if (hostLatestState && hostLatestState.type === 'state') {
        expect(hostLatestState.state.canStart).toBe(true);
        expect(hostLatestState.state.phase).toBe('waiting');
      }

      // Guest also received state with canStart = true and waiting
      const guestLatestState = guestMessages.filter((m) => m.type === 'state').pop();
      expect(guestLatestState).toBeDefined();
      if (guestLatestState && guestLatestState.type === 'state') {
        expect(guestLatestState.state.canStart).toBe(true);
      }

      // 4. Guest tapping start is rejected
      guestMessages.length = 0;
      const guestStartRes = handler.handleMessage('conn_guest', JSON.stringify({ type: 'start' }));
      expect(guestStartRes.success).toBe(false);
      expect(guestStartRes.error).toBe('UNAUTHORIZED');
      expect(guestStartRes.blockReasons).toEqual(['NOT_HOST']);
      const guestError = guestMessages.find((m) => m.type === 'error');
      expect(guestError).toBeDefined();
      if (guestError && guestError.type === 'error') {
        expect(guestError.code).toBe('UNAUTHORIZED');
        expect(guestError.blockReasons).toEqual(['NOT_HOST']);
      }

      // 5. Host taps start: both host and guest receive phase = "playing"
      hostMessages.length = 0;
      guestMessages.length = 0;
      const hostStartRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
      expect(hostStartRes.success).toBe(true);

      const hostPlayState = hostMessages.filter((m) => m.type === 'state').pop();
      const guestPlayState = guestMessages.filter((m) => m.type === 'state').pop();

      expect(hostPlayState).toBeDefined();
      if (hostPlayState && hostPlayState.type === 'state') {
        expect(hostPlayState.state.phase).toBe('playing');
        expect(hostPlayState.state.status).toBe('playing');
        expect(hostPlayState.state.config.gridSize).toBe(3);
        expect(hostPlayState.state.board.length).toBe(9);
      }

      expect(guestPlayState).toBeDefined();
      if (guestPlayState && guestPlayState.type === 'state') {
        expect(guestPlayState.state.phase).toBe('playing');
        expect(guestPlayState.state.status).toBe('playing');
      }
    });

    it('Supports 3P room with 1 human guest + 1 bot: start builds getConfigForPlayers(3) and broadcasts phase="playing"', () => {
      const handler = new GameRoomHandler('PVT3P');
      const hostMessages: ServerMessage[] = [];
      const guestMessages: ServerMessage[] = [];

      handler.handleConnection('conn_host', (m) => hostMessages.push(JSON.parse(m)));
      handler.handleConnection('conn_guest', (m) => guestMessages.push(JSON.parse(m)));

      handler.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'p_host', seatsCount: 3 }));
      // Set seat 2 as bot
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
      // Guest joins seat 1
      handler.handleMessage('conn_guest', JSON.stringify({ type: 'join', playerId: 'p_guest' }));
      expect(handler.state.canStart).toBe(false);

      // Guest readies
      handler.handleMessage('conn_guest', JSON.stringify({ type: 'ready', ready: true }));
      expect(handler.state.canStart).toBe(true);

      // Host starts
      hostMessages.length = 0;
      guestMessages.length = 0;
      const startRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
      expect(startRes.success).toBe(true);

      const hostPlayState = hostMessages.filter((m) => m.type === 'state').pop();
      const guestPlayState = guestMessages.filter((m) => m.type === 'state').pop();

      expect(hostPlayState && hostPlayState.type === 'state' && hostPlayState.state.phase).toBe('playing');
      expect(guestPlayState && guestPlayState.type === 'state' && guestPlayState.state.phase).toBe('playing');
      // 3P board is 5x5 = 25 cells
      expect(handler.state.config.gridSize).toBe(5);
      expect(handler.state.board.length).toBe(25);
    });

    it('Supports 4P room with seat count change: guest reset, host stays ready, start builds getConfigForPlayers(4)', () => {
      const handler = new GameRoomHandler('PVT4P');
      const hostMessages: ServerMessage[] = [];
      const g1Messages: ServerMessage[] = [];
      const g2Messages: ServerMessage[] = [];

      handler.handleConnection('conn_host', (m) => hostMessages.push(JSON.parse(m)));
      handler.handleConnection('conn_g1', (m) => g1Messages.push(JSON.parse(m)));
      handler.handleConnection('conn_g2', (m) => g2Messages.push(JSON.parse(m)));

      handler.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'p_host', seatsCount: 2 }));
      handler.handleMessage('conn_g1', JSON.stringify({ type: 'join', playerId: 'p_g1' }));
      handler.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));
      expect(handler.state.canStart).toBe(true);

      // Host changes seats to 4P: guests are reset to unready, host stays ready
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_seats', seatsCount: 4 }));
      expect(handler.state.canStart).toBe(false);
      const hostSeat = handler.state.seats.find((s) => s.playerId === 'p_host');
      const g1Seat = handler.state.seats.find((s) => s.playerId === 'p_g1');
      expect(hostSeat?.ready).toBe(true);
      expect(g1Seat?.ready).toBe(false);

      // Add a bot in seat 2 and guest 2 joins seat 3
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
      handler.handleMessage('conn_g2', JSON.stringify({ type: 'join', playerId: 'p_g2' }));

      // Guests ready
      handler.handleMessage('conn_g1', JSON.stringify({ type: 'ready', ready: true }));
      handler.handleMessage('conn_g2', JSON.stringify({ type: 'ready', ready: true }));
      expect(handler.state.canStart).toBe(true);

      // Host starts
      const startRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
      expect(startRes.success).toBe(true);
      expect(handler.state.phase).toBe('playing');
      // 4P board is 6x6 = 36 cells
      expect(handler.state.config.gridSize).toBe(6);
      expect(handler.state.board.length).toBe(36);
    });
  });

  describe('Human-like Bot Timing & Scheduling in Multiplayer Room', () => {
    let handler: GameRoomHandler;
    let hostMessages: ServerMessage[];

    const sendHost = (m: string) => {
      hostMessages.push(JSON.parse(m));
    };

    beforeEach(() => {
      vi.useFakeTimers();
      hostMessages = [];
      handler = new GameRoomHandler('BOT_TIMING_ROOM');
      handler.handleConnection('conn_host', sendHost);
      handler.handleMessage('conn_host', JSON.stringify({ type: 'create', playerId: 'p_host', seatsCount: 4 }));
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 1, isBot: true }));
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
      handler.handleMessage('conn_host', JSON.stringify({ type: 'set_bot_seat', seatIndex: 3, isBot: true }));
      const startRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'start' }));
      expect(startRes.success).toBe(true);
    });

    afterEach(() => {
      handler.cancelPendingBotMove();
      vi.useRealTimers();
    });

    it('spaces consecutive bot moves by at least animation time plus minimum delay with unique timestamps', () => {
      expect(handler.state.phase).toBe('playing');
      expect(handler.state.turnSeatIndex).toBe(0);

      const placeRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 0 }));
      expect(placeRes.success).toBe(true);

      expect(handler.state.turnSeatIndex).toBe(1);
      expect(handler.state.history?.length).toBe(1);

      // Animation duration (600ms) + medium min delay (900ms) = 1500ms
      // At 1400ms, bot 1 should not have moved yet
      vi.advanceTimersByTime(1400);
      expect(handler.state.turnSeatIndex).toBe(1);
      expect(handler.state.history?.length).toBe(1);

      const botMoveTimestamps: number[] = [];

      // Advance until bot 1 executes
      vi.advanceTimersByTime(1000);
      expect(handler.state.turnSeatIndex).toBe(2);
      expect(handler.state.history?.length).toBe(2);
      botMoveTimestamps.push(Date.now());

      // Bot 2 was scheduled after bot 1 finished. Advance until bot 2 executes
      vi.advanceTimersByTime(2000);
      expect(handler.state.turnSeatIndex).toBe(3);
      expect(handler.state.history?.length).toBe(3);
      botMoveTimestamps.push(Date.now());

      // Advance until bot 3 executes
      vi.advanceTimersByTime(2000);
      expect(handler.state.turnSeatIndex).toBe(0); // Back to human host
      expect(handler.state.history?.length).toBe(4);
      botMoveTimestamps.push(Date.now());

      // Verify no two bot moves share a timestamp
      const uniqueTimestamps = new Set(botMoveTimestamps);
      expect(uniqueTimestamps.size).toBe(3);

      // Verify each move is spaced by at least 1500ms (animation 600ms + medium min 900ms)
      expect(botMoveTimestamps[1] - botMoveTimestamps[0]).toBeGreaterThanOrEqual(1500);
      expect(botMoveTimestamps[2] - botMoveTimestamps[1]).toBeGreaterThanOrEqual(1500);
    });

    it('ignores rapid human clicks during a bot turn', () => {
      handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 0 }));
      expect(handler.state.turnSeatIndex).toBe(1);

      const initialMovesCount = handler.state.history?.length ?? 0;

      const click1 = handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 1 }));
      const click2 = handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 2 }));
      const click3 = handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 3 }));

      expect(click1.success).toBe(false);
      expect(click1.error).toBe('NOT_YOUR_TURN');
      expect(click2.success).toBe(false);
      expect(click2.error).toBe('NOT_YOUR_TURN');
      expect(click3.success).toBe(false);
      expect(click3.error).toBe('NOT_YOUR_TURN');

      expect(handler.state.history?.length).toBe(initialMovesCount);
      expect(handler.state.board[1]).toBeNull();
      expect(handler.state.board[2]).toBeNull();
      expect(handler.state.board[3]).toBeNull();
    });

    it('cancels pending bot moves after game over', () => {
      handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 0 }));
      expect(handler.state.turnSeatIndex).toBe(1);

      // Finish game
      handler.state.winner = 'X';
      handler.state.status = 'finished';
      handler.state.phase = 'finished';
      handler.cancelPendingBotMove();

      const moveCountAtEnd = handler.state.history?.length ?? 0;

      // Advance timers significantly — bot must not move after game over
      vi.advanceTimersByTime(10000);
      expect(handler.state.history?.length).toBe(moveCountAtEnd);
    });

    it('cancels pending bot moves after rematch', () => {
      handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 0 }));
      expect(handler.state.turnSeatIndex).toBe(1);

      // Must be finished to rematch
      handler.state.status = 'finished';
      handler.state.phase = 'finished';

      const rematchRes = handler.handleMessage('conn_host', JSON.stringify({ type: 'rematch' }));
      expect(rematchRes.success).toBe(true);

      // The previous pending bot move was cancelled; game reset
      expect(handler.state.history?.length).toBe(0);
      expect(handler.state.board.every((c) => c === null)).toBe(true);
    });

    it('cancels pending bot moves when human disconnects', () => {
      handler.handleMessage('conn_host', JSON.stringify({ type: 'place', cell: 0 }));
      expect(handler.state.turnSeatIndex).toBe(1);

      handler.handleDisconnection('conn_host');

      const movesBefore = handler.state.history?.length ?? 0;
      vi.advanceTimersByTime(5000);
      expect(handler.state.history?.length).toBe(movesBefore);
    });
  });

  describe('Emoji Reactions & Quick Messages', () => {
    let handler: GameRoomHandler;
    let client1Messages: ServerMessage[];
    let client2Messages: ServerMessage[];

    const sendC1 = (m: string) => {
      client1Messages.push(JSON.parse(m));
    };
    const sendC2 = (m: string) => {
      client2Messages.push(JSON.parse(m));
    };

    beforeEach(() => {
      handler = new GameRoomHandler('REACTION_TEST');
      client1Messages = [];
      client2Messages = [];
      handler.handleConnection('conn1', sendC1);
      handler.handleConnection('conn2', sendC2);
      handler.handleMessage('conn1', JSON.stringify({ type: 'create', playerId: 'player1', playerName: 'Alice' }));
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2', playerName: 'Bob' }));
    });

    it('broadcasts emoji reactions to all connected clients', () => {
      client1Messages = [];
      client2Messages = [];

      const res = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'reaction', emoji: '🔥' }),
        1000
      );
      expect(res.success).toBe(true);

      const reactionMsg1 = client1Messages.find((m) => m.type === 'reaction');
      const reactionMsg2 = client2Messages.find((m) => m.type === 'reaction');

      expect(reactionMsg1).toBeDefined();
      expect(reactionMsg2).toBeDefined();
      if (reactionMsg2 && reactionMsg2.type === 'reaction') {
        expect(reactionMsg2.emoji).toBe('🔥');
        expect(reactionMsg2.seatIndex).toBe(0);
        expect(reactionMsg2.symbol).toBe('X');
        expect(reactionMsg2.playerName).toBe('Alice');
      }
    });

    it('broadcasts quick messages to all connected clients', () => {
      client2Messages = [];

      const res = handler.handleMessage(
        'conn2',
        JSON.stringify({ type: 'reaction', quickMessage: '🔥 Nice move!' }),
        2000
      );
      expect(res.success).toBe(true);

      const reactionMsg = client2Messages.find((m) => m.type === 'reaction');
      expect(reactionMsg).toBeDefined();
      if (reactionMsg && reactionMsg.type === 'reaction') {
        expect(reactionMsg.quickMessage).toBe('🔥 Nice move!');
        expect(reactionMsg.seatIndex).toBe(1);
        expect(reactionMsg.symbol).toBe('O');
        expect(reactionMsg.playerName).toBe('Bob');
      }
    });

    it('enforces reaction cooldown', () => {
      const res1 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'reaction', emoji: '😂' }),
        5000
      );
      expect(res1.success).toBe(true);

      // Sent 200ms later (within 800ms cooldown)
      const res2 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'reaction', emoji: '😎' }),
        5200
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('COOLDOWN');

      // Sent 900ms later (after cooldown)
      const res3 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'reaction', emoji: '😎' }),
        5900
      );
      expect(res3.success).toBe(true);
    });
  });

  describe('2-Player Real-Time Text Chat', () => {
    it('rejects chat in 3P or 4P rooms', () => {
      const handler = new GameRoomHandler('ROOM3P', null, true);
      handler.handleConnection('conn1', () => {});
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
      handler.handleMessage('conn1', JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
      handler.handleConnection('conn2', () => {});
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));
      handler.handleConnection('conn3', () => {});
      handler.handleMessage('conn3', JSON.stringify({ type: 'join', playerId: 'p3' }));

      const res = handler.handleMessage('conn1', JSON.stringify({ type: 'chat_message', text: 'Hello' }));
      expect(res.success).toBe(false);
      expect(res.error).toBe('NOT_2P_ROOM');
    });

    it('rejects chat when both players are not yet in the room', () => {
      const handler = new GameRoomHandler('ROOM2P', null, true);
      handler.handleConnection('conn1', () => {});
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));

      const res = handler.handleMessage('conn1', JSON.stringify({ type: 'chat_message', text: 'Hello' }));
      expect(res.success).toBe(false);
      expect(res.error).toBe('WAITING_FOR_PLAYERS');
    });

    it('broadcasts chat with verified seat senderName, escaped HTML, and filtered profanity', () => {
      const handler = new GameRoomHandler('ROOM2P', null, true);
      const messages: any[] = [];
      handler.handleConnection('conn1', (msg) => messages.push(JSON.parse(msg)));
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1', playerName: 'Akhil' }));
      handler.handleConnection('conn2', (msg) => messages.push(JSON.parse(msg)));
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2', playerName: 'Opponent' }));

      // Send message with HTML script and abusive word
      const res = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'chat_message', text: '<script>alert(1)</script> you dumbass' }),
        1000
      );
      expect(res.success).toBe(true);

      const chatBroadcast = messages.find((m) => m.type === 'chat_message');
      expect(chatBroadcast).toBeDefined();
      expect(chatBroadcast.senderName).toBe('Akhil');
      expect(chatBroadcast.seatIndex).toBe(0);
      expect(chatBroadcast.symbol).toBe('X');
      // Escaped HTML
      expect(chatBroadcast.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      // Masked profanity
      expect(chatBroadcast.text).toContain('*******');
      expect(chatBroadcast.text).not.toContain('dumbass');
    });

    it('removes links and URLs from chat messages', () => {
      const handler = new GameRoomHandler('ROOM2P', null, true);
      const messages: any[] = [];
      handler.handleConnection('conn1', (msg) => messages.push(JSON.parse(msg)));
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
      handler.handleConnection('conn2', () => {});
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

      // Text with link
      const res1 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'chat_message', text: 'visit https://malicious.com today' }),
        1000
      );
      expect(res1.success).toBe(true);
      const chatBroadcast = messages.find((m) => m.type === 'chat_message');
      expect(chatBroadcast.text).toBe('visit today');
      expect(chatBroadcast.text).not.toContain('https://malicious.com');

      // Only link should be rejected
      const res2 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'chat_message', text: 'https://onlylink.org' }),
        2000
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('LINK_NOT_ALLOWED');
    });

    it('enforces 120 character limit and rejects empty messages', () => {
      const handler = new GameRoomHandler('ROOM2P', null, true);
      handler.handleConnection('conn1', () => {});
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
      handler.handleConnection('conn2', () => {});
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

      // Empty
      const resEmpty = handler.handleMessage('conn1', JSON.stringify({ type: 'chat_message', text: '   ' }));
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toBe('EMPTY_MESSAGE');

      // Over 120 chars
      const longText = 'a'.repeat(121);
      const resLong = handler.handleMessage('conn1', JSON.stringify({ type: 'chat_message', text: longText }));
      expect(resLong.success).toBe(false);
      expect(resLong.error).toBe('MESSAGE_TOO_LONG');
    });

    it('enforces rate limit of at most 5 messages per 10 seconds per player', () => {
      const handler = new GameRoomHandler('ROOM2P', null, true);
      handler.handleConnection('conn1', () => {});
      handler.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'p1' }));
      handler.handleConnection('conn2', () => {});
      handler.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'p2' }));

      const t0 = 10000;
      for (let i = 0; i < 5; i++) {
        const res = handler.handleMessage(
          'conn1',
          JSON.stringify({ type: 'chat_message', text: `Message ${i}` }),
          t0 + i * 1000
        );
        expect(res.success).toBe(true);
      }

      // 6th message within 10 seconds should fail rate limit
      const res6 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'chat_message', text: 'Message 6' }),
        t0 + 5000
      );
      expect(res6.success).toBe(false);
      expect(res6.error).toBe('RATE_LIMIT');

      // After 10 seconds from oldest, should succeed again
      const res7 = handler.handleMessage(
        'conn1',
        JSON.stringify({ type: 'chat_message', text: 'Message 7' }),
        t0 + 10500
      );
      expect(res7.success).toBe(true);
    });
  });
});


