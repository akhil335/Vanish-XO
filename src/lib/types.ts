import { z } from 'zod';

export type MarkSymbol = 'X' | 'O' | '▲' | '■';

export const MARK_SYMBOLS: MarkSymbol[] = ['X', 'O', '▲', '■'];

export const SEAT_COLORS: Record<MarkSymbol, { hex: string; glow: string; textGlow: string }> = {
  X: { hex: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)', textGlow: '0 0 10px rgba(0, 240, 255, 0.8)' },
  O: { hex: '#ff007f', glow: 'rgba(255, 0, 127, 0.4)', textGlow: '0 0 10px rgba(255, 0, 127, 0.8)' },
  '▲': { hex: '#ffe600', glow: 'rgba(255, 230, 0, 0.4)', textGlow: '0 0 10px rgba(255, 230, 0, 0.8)' },
  '■': { hex: '#b026ff', glow: 'rgba(176, 38, 255, 0.4)', textGlow: '0 0 10px rgba(176, 38, 255, 0.8)' },
};

export interface GameConfig {
  playerCount: number;
  gridSize: number;
  totalCells: number;
  marksPerPlayer: number;
  winStreak: number;
}

export interface PlayerSeat {
  seatIndex: number;
  symbol: MarkSymbol;
  playerId: string | null;
  playerName?: string | null;
  name?: string | null;
  userId?: string | null;
  kind?: 'human' | 'bot' | 'empty';
  isBot: boolean;
  isReady: boolean;
  isConnected: boolean;
  ready?: boolean;
  connected?: boolean;
  disconnectedAt: number | null;
  joinedAt?: number | null;
}

export interface VanishedEvent {
  symbol: MarkSymbol;
  cell: number;
}

export interface MoveRecord {
  player: MarkSymbol;
  cell: number;
  vanished: VanishedEvent | null;
}

export interface RoomState {
  roomCode: string;
  gameId?: string | null;
  isAbandoned?: boolean;
  status: 'uninitialized' | 'waiting' | 'playing' | 'finished';
  phase?: 'uninitialized' | 'waiting' | 'playing' | 'finished';
  seatsCount: 2 | 3 | 4;
  seatCount?: 2 | 3 | 4;
  readyCount?: number;
  requiredCount?: number;
  canStart?: boolean;
  blockReasons?: string[];
  config: GameConfig;
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
  matchToken?: string;
  history?: MoveRecord[];
  lastMoveCell?: number | null;
  rematchRequest?: {
    requestedBy: string;
    requestedBySeatIndex: number;
    requestedAt: number;
    requesterName?: string;
  } | null;
  rematchDeclined?: boolean;
  paused?: boolean;
  pausedReason?: 'opponent_disconnected' | 'opponent_left' | 'opponent_abandoned' | string | null;
  disconnectGraceExpiresAt?: number | null;
}

// Matchmaking config passed when joining a matchmade room
export const MatchConfigSchema = z.object({
  seatsCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  assignedSeatIndex: z.number().int().min(0).max(3),
  startingSeatIndex: z.number().int().min(0).max(3),
  botSeats: z.array(z.number().int().min(0).max(3)),
});
export type MatchConfig = z.infer<typeof MatchConfigSchema>;

// Client to Server Intents for Game Rooms
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create'),
    playerId: z.string().min(1).max(64),
    playerName: z.string().max(64).optional(),
    name: z.string().max(64).optional(),
    userId: z.string().max(128).optional(),
    seatsCount: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    matchToken: z.string().optional(),
    matchConfig: MatchConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('join'),
    playerId: z.string().min(1).max(64),
    playerName: z.string().max(64).optional(),
    name: z.string().max(64).optional(),
    userId: z.string().max(128).optional(),
    matchConfig: MatchConfigSchema.optional(),
    matchToken: z.string().optional(),
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
    cell: z.number().int().min(0).max(35),
  }),
  z.object({
    type: z.literal('rematch'),
  }),
  z.object({
    type: z.literal('rematch_request'),
  }),
  z.object({
    type: z.literal('rematch_accept'),
  }),
  z.object({
    type: z.literal('rematch_decline'),
  }),
  z.object({
    type: z.literal('leave'),
  }),
  z.object({
    type: z.literal('ping'),
  }),
  z.object({
    type: z.literal('reaction'),
    emoji: z.string().max(16).optional(),
    quickMessage: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal('chat_message'),
    text: z.string().max(300),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface RoomChatMessage {
  id: string;
  seatIndex: number;
  symbol: MarkSymbol;
  senderName: string;
  text: string;
  timestamp: number;
}

// Server to Client Messages for Game Rooms
export type ServerMessage =
  | { type: 'state'; state: RoomState }
  | { type: 'error'; code: string; message?: string; blockReasons?: string[] }
  | { type: 'player_joined'; seatIndex: number; isBot: boolean }
  | { type: 'player_left'; seatIndex: number }
  | { type: 'host_changed'; newHostPlayerId: string; seatIndex: number }
  | {
      type: 'reaction';
      id: string;
      seatIndex: number;
      symbol: MarkSymbol;
      playerName: string;
      emoji?: string;
      quickMessage?: string;
      timestamp: number;
    }
  | {
      type: 'chat_message';
      id: string;
      seatIndex: number;
      symbol: MarkSymbol;
      senderName: string;
      text: string;
      timestamp: number;
    }
  | {
      type: 'chat_error';
      code: string;
      message: string;
    };

export const EMOJI_REACTIONS = [
  '😂',
  '😎',
  '🔥',
  '😭',
  '🤯',
  '👏',
  '❤️',
  '😈',
  '😱',
  '💀',
] as const;
export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];

export const QUICK_MESSAGES = [
  '👋 Hello!',
  '😂 Haha!',
  '🔥 Nice move!',
  "😎 Let's go!",
  '😭 So close!',
  '👏 Well played!',
  '🤝 Good game!',
  '🏆 I won!',
  '😈 Your turn!',
  '😱 What a move!',
] as const;
export type QuickMessage = (typeof QUICK_MESSAGES)[number];

export interface LiveReaction {
  id: string;
  seatIndex: number;
  symbol: MarkSymbol;
  playerName: string;
  emoji?: string;
  quickMessage?: string;
  timestamp: number;
}

// Matchmaking Lobby Messages (Client -> Server)
export const LobbyClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('queue_join'),
    playerId: z.string().min(1).max(64),
    targetCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  }),
  z.object({
    type: z.literal('queue_leave'),
    playerId: z.string().min(1).max(64),
  }),
]);

export type LobbyClientMessage = z.infer<typeof LobbyClientMessageSchema>;

// Matchmaking Lobby Messages (Server -> Client)
export type LobbyServerMessage =
  | {
      type: 'queue_status';
      searchingCounts: Record<2 | 3 | 4, number>;
      totalSearching: number;
      myQueue?: {
        targetCount: 2 | 3 | 4;
        currentCount: number;
        playersNeeded: number;
      };
    }
  | {
      type: 'match_found';
      roomCode: string;
      token?: string;
      matchToken?: string;
      seatIndex: number;
      seatsCount: 2 | 3 | 4;
      startingSeatIndex: number;
      botSeats: number[];
      countdownMs: number;
    }
  | {
      type: 'server_busy';
    }
  | {
      type: 'error';
      code: string;
      message?: string;
    };

// 5-character room code generator without confusing characters (no 0, O, 1, I)
// 32 characters => 32^5 = 33,554,432 combinations (~33.5 million)
export const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += ROOM_CODE_CHARS.charAt(bytes[i] % 32);
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const upper = code.trim().toUpperCase();
  if (upper.length !== 5) return false;
  for (let i = 0; i < 5; i++) {
    if (!ROOM_CODE_CHARS.includes(upper[i])) return false;
  }
  return true;
}

export function generateMatchToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
