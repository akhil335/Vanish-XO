'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import PartySocket from 'partysocket';
import { ArrowLeft, Share2, Play, Check, Users, Eye } from 'lucide-react';
import { RoomState, ServerMessage, MarkSymbol } from '@/lib/types';
import { getOrCreatePlayerId, getPartyKitHost } from '@/lib/player';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { GameBoard } from '@/components/GameBoard';
import { OnlinePlayerBar } from '@/components/OnlinePlayerBar';
import { WinModal } from '@/components/WinModal';
import { ToastNotification, ToastItem } from '@/components/ToastNotification';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

function RoomPageContent() {
  const params = useParams();
  const roomCode = ((params?.code as string) || '').toUpperCase();

  const [playerId, setPlayerId] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [vanishedAnim, setVanishedAnim] = useState<{
    cell: number;
    player: MarkSymbol;
    id: number;
  } | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  const prevStateRef = useRef<RoomState | null>(null);

  // Initialize player ID from localStorage
  useEffect(() => {
    const id = getOrCreatePlayerId();
    const timer = setTimeout(() => {
      setPlayerId(id);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Web Share / Copy Link
  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vanish XO Online',
          text: `Join Vanish XO room ${roomCode}!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toast helper
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  // PartySocket Connection
  useEffect(() => {
    if (!playerId) return;

    const host = getPartyKitHost();
    const socket = new PartySocket({
      host,
      room: roomCode,
    });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'join', playerId }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        if (msg.type === 'state') {
          const nextState = msg.state;
          const prev = prevStateRef.current;

          // Detect audio / haptic triggers from state transitions
          if (prev) {
            // Placement sound
            if (nextState.status === 'playing' && prev.status === 'playing') {
              const prevTurn = prev.turnSeatIndex;
              const prevSymbol = prev.seats[prevTurn]?.symbol;
              if (prevSymbol) {
                soundManager.playPlace(prevSymbol === 'X' ? 'X' : 'O');
              }
            }

            // Vanish sound & particle
            if (nextState.lastVanished && (!prev.lastVanished || prev.lastVanished.cell !== nextState.lastVanished.cell || prev.lastVanished.symbol !== nextState.lastVanished.symbol)) {
              soundManager.playVanish();
              triggerHaptic('vanish');
              setVanishedAnim({
                cell: nextState.lastVanished.cell,
                player: nextState.lastVanished.symbol,
                id: Date.now(),
              });
            }

            // Win sound & haptic
            if (nextState.winner && !prev.winner) {
              soundManager.playWin();
              triggerHaptic('win');
            }
          }

          prevStateRef.current = nextState;
          setRoomState(nextState);
        } else if (msg.type === 'player_joined') {
          addToast({ type: 'player_joined', seatIndex: msg.seatIndex, isBot: msg.isBot });
        } else if (msg.type === 'player_left') {
          addToast({ type: 'player_left', seatIndex: msg.seatIndex });
        }
      } catch {
        // Safe catch
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, roomCode, addToast]);

  // Derived Player Info
  const mySeat = roomState?.seats.find((s) => s.playerId === playerId);
  const mySeatIndex = mySeat !== undefined ? mySeat.seatIndex : null;
  const isSpectator = mySeatIndex === null;
  const isHost = roomState?.hostPlayerId === playerId;
  const isMyTurn = roomState?.status === 'playing' && roomState.turnSeatIndex === mySeatIndex;

  // Actions
  const handleCellClick = (cellIndex: number) => {
    if (!socketRef.current || !isMyTurn) return;
    socketRef.current.send(JSON.stringify({ type: 'place', cell: cellIndex }));
  };

  const handleSetSeats = (seatsCount: 2 | 3 | 4) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'set_seats', seatsCount }));
  };

  const handleToggleBot = (seatIndex: number, currentIsBot: boolean) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'set_bot_seat', seatIndex, isBot: !currentIsBot }));
  };

  const handleToggleReady = (ready: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'ready', ready }));
  };

  const handleStartGame = () => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'start' }));
  };

  const handleRematch = () => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'rematch' }));
  };

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06080d] text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs tracking-widest uppercase">JOINING {roomCode}...</span>
        </div>
      </div>
    );
  }

  const allReadyToStart = roomState.seats.every((s) => s.isBot || (s.playerId && s.isReady));
  const contentWidth = roomState.seatsCount === 4 ? 'max-w-[440px]' : roomState.seatsCount === 3 ? 'max-w-[400px]' : 'max-w-[360px]';

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-between px-3 py-4 select-none overflow-x-hidden">
      {/* Toast notifications */}
      <ToastNotification toasts={toasts} />

      {/* Main Room Container */}
      <div className={`w-full ${contentWidth} flex flex-col items-center gap-3 my-auto transition-all duration-300`}>
        {/* Header Bar */}
        <div className="w-full flex items-center justify-between px-1">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900/80 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-xl border border-white/10 font-mono">
            <span className="text-xs text-slate-400">ROOM</span>
            <span className="text-sm font-black text-cyan-400 tracking-wider">{roomCode}</span>
          </div>

          {/* Invite / Share button */}
          <div className="relative">
            <button
              type="button"
              id="invite-room-btn"
              onClick={handleShare}
              className="p-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
            </button>
            {copied && (
              <span className="absolute -top-7 right-0 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-black shadow-md tracking-wider uppercase pointer-events-none">
                COPIED
              </span>
            )}
          </div>
        </div>

        {/* Spectator Warning Banner */}
        {isSpectator && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
            <Eye size={14} />
            <span>SPECTATING</span>
          </div>
        )}

        {/* Online Player Bar & Turn Countdown */}
        <div className="w-full">
          <OnlinePlayerBar
            roomState={roomState}
            mySeatIndex={mySeatIndex}
            isHost={isHost}
            onToggleBot={handleToggleBot}
            onToggleReady={handleToggleReady}
          />
        </div>

        {/* Lobby Waiting Controls for Host */}
        {roomState.status === 'waiting' && isHost && (
          <div className="w-full flex items-center justify-between gap-2 p-2 bg-slate-900/80 rounded-2xl border border-white/10 backdrop-blur-md">
            {/* Seats count toggle: 2, 3, 4 */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
              <Users size={14} className="text-slate-400 ml-1 mr-0.5" />
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  id={`seats-count-${count}`}
                  onClick={() => handleSetSeats(count)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    roomState.seatsCount === count
                      ? 'bg-cyan-400 text-black font-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* Start Button */}
            <button
              type="button"
              id="start-game-btn"
              disabled={!allReadyToStart}
              onClick={handleStartGame}
              className={`flex-1 py-2 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                allReadyToStart
                  ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/30 hover:bg-emerald-300 cursor-pointer active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play size={14} fill="currentColor" />
              <span>START</span>
            </button>
          </div>
        )}

        {/* Interactive 3x3 Board */}
        <GameBoard
          roomState={roomState}
          onCellClick={handleCellClick}
          disabled={!isMyTurn || roomState.status !== 'playing'}
          vanishedAnim={vanishedAnim}
          onVanishedAnimComplete={() => setVanishedAnim(null)}
        />
      </div>

      {/* Win Modal */}
      <WinModal
        winner={roomState.winner}
        onPlayAgain={handleRematch}
      />
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#06080d] text-cyan-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs tracking-widest uppercase">LOADING ROOM...</span>
          </div>
        </div>
      }
    >
      <RoomPageContent />
    </Suspense>
  );
}
