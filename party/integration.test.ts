import { describe, it, expect } from 'vitest';
import PartySocket from 'partysocket';
import { RoomState, ServerMessage, MarkSymbol } from '../src/lib/types';

describe('Vanish XO - Live PartyKit Integration Test (2 human players + 1 bot in 3-player room)', () => {
  it('connects two live clients to a 3-player room with 1 bot and completes moves', async () => {
    const roomCode = 'R' + Math.random().toString(36).substring(2, 5).toUpperCase();
    const host = '127.0.0.1:1999';

    // Client 1 (Host: Player 1)
    const client1 = new PartySocket({
      host,
      room: roomCode,
    });

    // Client 2 (Player 2)
    const client2 = new PartySocket({
      host,
      room: roomCode,
    });

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

    // Wait for connection
    await new Promise((resolve) => {
      let openCount = 0;
      const onOpen = () => {
        openCount++;
        if (openCount === 2) resolve(true);
      };
      client1.addEventListener('open', onOpen);
      client2.addEventListener('open', onOpen);
    });

    // 1. Host joins
    client1.send(JSON.stringify({ type: 'join', playerId: 'human_host' }));
    await new Promise((r) => setTimeout(r, 100));

    // 2. Host configures room for 3 seats
    client1.send(JSON.stringify({ type: 'set_seats', seatsCount: 3 }));
    await new Promise((r) => setTimeout(r, 100));
    expect(states.s1?.seatsCount).toBe(3);

    // 3. Host fills seat 2 with a bot
    client1.send(JSON.stringify({ type: 'set_bot_seat', seatIndex: 2, isBot: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(states.s1?.seats[2].isBot).toBe(true);

    // 4. Player 2 joins
    client2.send(JSON.stringify({ type: 'join', playerId: 'human_player2' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(states.s1?.seats[1].playerId).toBe('human_player2');

    // 5. Player 2 readies up
    client2.send(JSON.stringify({ type: 'ready', ready: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(states.s1?.seats[1].isReady).toBe(true);

    // 6. Host starts the game
    client1.send(JSON.stringify({ type: 'start' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(states.s1?.status).toBe('playing');
    expect(states.s1?.turnSeatIndex).toBe(0); // Host's turn ('X')

    // 7. Host plays cell 0
    client1.send(JSON.stringify({ type: 'place', cell: 0 }));
    await new Promise((r) => setTimeout(r, 150));
    expect(states.s1?.board[0]).toBe('X');
    expect(states.s1?.turnSeatIndex).toBe(1); // Player 2's turn ('O')

    // 8. Player 2 plays cell 3
    client2.send(JSON.stringify({ type: 'place', cell: 3 }));
    await new Promise((r) => setTimeout(r, 150));
    expect(states.s2?.board[3]).toBe('O');

    // 9. Bot's turn (Seat 2, '▲')!
    // The server immediately/automatically executes bot move!
    await new Promise((r) => setTimeout(r, 300));

    // Confirm that Bot (symbol '▲') placed a mark on the board!
    const botMarkPlaced = states.s1?.board.some((c: MarkSymbol | null) => c === '▲');
    expect(botMarkPlaced).toBe(true);

    // Turn rotated back to Seat 0 (Host)!
    expect(states.s1?.turnSeatIndex).toBe(0);

    client1.close();
    client2.close();
  });
});
