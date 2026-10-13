import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoomHandler } from './room';
import { ServerMessage } from '../src/lib/types';
import { getLegalMoves } from '../src/lib/game';

describe('Vanish XO - PartyKit Server Message Handler', () => {
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
    room = new GameRoomHandler('TEST');
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

  it('converts seat to bot after 60 seconds of disconnection', () => {
    room.handleMessage('conn1', JSON.stringify({ type: 'join', playerId: 'player1' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'join', playerId: 'player2' }));
    room.handleMessage('conn2', JSON.stringify({ type: 'ready', ready: true }));
    const startTime = 1000000;
    room.handleMessage('conn1', JSON.stringify({ type: 'start' }), startTime);

    // Player 2 disconnects at T = 1,000,000
    room.handleDisconnection('conn2', startTime);
    expect(room.state.seats[1].isConnected).toBe(false);

    // 30s later: not yet bot
    room.tick(startTime + 30000);
    expect(room.state.seats[1].isBot).toBe(false);

    // 60s later: bot takes over seat!
    room.tick(startTime + 60000);
    expect(room.state.seats[1].isBot).toBe(true);
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

  it('rotates starting player on rematch', () => {
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

    // Trigger rematch
    room.handleMessage('conn1', JSON.stringify({ type: 'rematch' }));
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
        const rematchRes = room.handleMessage('conn1', JSON.stringify({ type: 'rematch' }), simTime);
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
});
