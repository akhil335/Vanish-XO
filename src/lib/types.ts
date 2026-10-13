import { z } from 'zod';

export type MarkSymbol = 'X' | 'O' | '▲' | '■';

export const MARK_SYMBOLS: MarkSymbol[] = ['X', 'O', '▲', '■'];

export const SEAT_COLORS: Record<MarkSymbol, { hex: string; glow: string; textGlow: string }> = {
  X: { hex: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)', textGlow: '0 0 10px rgba(0, 240, 255, 0.8)' },
  O: { hex: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)', textGlow: '0 0 10px rgba(255, 0, 127, 0.8)' },
  '▲': { hex: '#ffe600', glow: 'rgba(255, 230, 0, 0.4)', textGlow: '0 0 10px rgba(255, 230, 0, 0.8)' },
  '■': { hex: '#b026ff', glow: 'rgba(176, 38, 255, 0.4)', textGlow: '0 0 10px rgba(176, 38, 255, 0.8)' },
};

export interface PlayerSeat {
  seatIndex: number;
  symbol: MarkSymbol;
  playerId: string | null;
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  disconnectedAt: number | null;
}

export interface VanishedEvent {
  symbol: MarkSymbol;
  cell: number;
}

export interface RoomState {
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished';
  seatsCount: 2 | 3 | 4;
  seats: PlayerSeat[];
  hostPlayerId: string | null;
  board: (MarkSymbol | null)[];
  playerMoves: Record<MarkSymbol, number[]>;
  turnSeatIndex: number;
  turnStartedAt: number;
  turnDurationMs: number;
  startingSeatIndex: number;
  winner: MarkSymbol | null;
  winningLine: [number, number, number] | null;
  lastVanished: VanishedEvent | null;
  spectatorCount: number;
}

// Client to Server Intents
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    playerId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('set_seats'),
    seatsCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  }),
  z.object({
    type: z.literal('set_bot_seat'),
    seatIndex: z.number().int().min(0).max(3),
    isBot: z.boolean(),
  }),
  z.object({
    type: z.literal('ready'),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('start'),
  }),
  z.object({
    type: z.literal('place'),
    cell: z.number().int().min(0).max(8),
  }),
  z.object({
    type: z.literal('rematch'),
  }),
  z.object({
    type: z.literal('leave'),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server to Client Messages
export type ServerMessage =
  | { type: 'state'; state: RoomState }
  | { type: 'error'; code: string; message?: string }
  | { type: 'player_joined'; seatIndex: number; isBot: boolean }
  | { type: 'player_left'; seatIndex: number };

// 4-character room code generator without confusing characters (no 0, O, 1, I)
export const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== 4) return false;
  const upper = code.toUpperCase();
  for (let i = 0; i < 4; i++) {
    if (!ROOM_CODE_CHARS.includes(upper[i])) return false;
  }
  return true;
}
