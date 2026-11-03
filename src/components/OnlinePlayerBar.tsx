'use client';

import React, { useEffect, useState } from 'react';
import { Bot, User, Crown, Check, Circle, Share2, Plus, X } from 'lucide-react';
import { RoomState, PlayerSeat, SEAT_COLORS } from '@/lib/types';
import { generateGuestName } from '@/lib/player';

interface OnlinePlayerBarProps {
  roomState: RoomState;
  mySeatIndex: number | null; // which seat belongs to local player, or null if spectator
  isHost: boolean;
  myPlayerName?: string;
  highlightUnready?: boolean;
  blockReasons?: string[];
  onToggleBot?: (seatIndex: number, currentIsBot: boolean) => void;
  onToggleReady?: (ready: boolean) => void;
  onShare?: () => void;
}

export const OnlinePlayerBar: React.FC<OnlinePlayerBarProps> = ({
  roomState,
  mySeatIndex,
  isHost,
  myPlayerName,
  highlightUnready = false,
  blockReasons = [],
  onToggleBot,
  onShare,
}) => {
  const [now, setNow] = useState<number>(0);

  const phase = roomState.phase ?? roomState.status;

  // High-frequency tick for smooth countdown bar animation
  useEffect(() => {
    if ((roomState.phase ?? roomState.status) !== 'playing') return;
    const update = () => setNow(Date.now());
    const timer = setTimeout(update, 0);
    const interval = setInterval(update, 100);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [roomState.phase, roomState.status, roomState.turnStartedAt]);

  const { seats, seatsCount, turnSeatIndex, turnStartedAt, turnDurationMs, playerMoves } = roomState;

  // Layout grid based on seatsCount: 2 seats = 2 cols; 3 seats = 3 cols; 4 seats = 4 cols (or 2x2)
  const gridColsClass =
    seatsCount === 2
      ? 'grid-cols-2'
      : seatsCount === 3
      ? 'grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className={`w-full grid ${gridColsClass} gap-2 select-none`}>
      {seats.map((seat: PlayerSeat) => {
        const isMySeat = mySeatIndex === seat.seatIndex;
        const isTurn = phase === 'playing' && turnSeatIndex === seat.seatIndex;
        const config = SEAT_COLORS[seat.symbol] || SEAT_COLORS.X;
        const isSeatHost = roomState.hostPlayerId === seat.playerId && !seat.isBot && seat.playerId !== null;

        // Categorize state
        const isBot = Boolean(seat.isBot || seat.kind === 'bot');
        const isEmpty = (!seat.playerId || seat.kind === 'empty') && !isBot;
        const isOffline = Boolean(seat.playerId && (seat.connected === false || seat.isConnected === false));
        const isReady = Boolean((seat.playerId && !isOffline && (seat.ready || seat.isReady)) || isBot);

        // Turn timer countdown calculation (20s)
        let timerPercent = 100;
        if (isTurn && phase === 'playing') {
          const elapsed = Math.max(0, now - turnStartedAt);
          const remaining = Math.max(0, turnDurationMs - elapsed);
          timerPercent = Math.min(100, (remaining / turnDurationMs) * 100);
        }

        const moves = playerMoves[seat.symbol] || [];

        const rawName = isMySeat
          ? (myPlayerName || seat.playerName || seat.name)
          : (seat.playerName || seat.name);

        const resolvedName = isBot
          ? 'Bot'
          : isEmpty
          ? 'Waiting for player...'
          : (rawName && rawName.trim() && rawName.trim() !== 'Player')
          ? rawName.trim()
          : (seat.playerId && seat.playerId.startsWith('p_') ? generateGuestName(seat.playerId) : (rawName || 'Player'));

        // 1. Waiting Lobby States
        if (phase === 'waiting') {
          const isEmptyBlocking = highlightUnready && (blockReasons.includes('SEATS_NOT_FILLED') || blockReasons.includes('UNFILLED_SEATS') || blockReasons.length === 0);
          const isSeatBlocking = highlightUnready && !isReady && (blockReasons.includes('NOT_ALL_READY') || blockReasons.length === 0);

          // EMPTY State: dashed outline, pulsing share icon
          if (isEmpty) {
            return (
              <div
                key={seat.seatIndex}
                onClick={() => onShare && onShare()}
                className={`relative flex flex-col justify-between p-2.5 rounded-2xl border-2 border-dashed transition-all duration-300 min-h-[90px] cursor-pointer group select-none ${
                  isEmptyBlocking
                    ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(251,191,36,0.4)] animate-pulse'
                    : 'border-cyan-500/30 bg-slate-950/40 hover:border-cyan-400/60 hover:bg-slate-900/60'
                }`}
              >
                {/* Top Row: Symbol */}
                <div className="flex items-center justify-between">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs border opacity-40"
                    style={{
                      color: config.hex,
                      borderColor: `${config.hex}44`,
                      backgroundColor: `${config.hex}10`,
                    }}
                  >
                    {seat.symbol}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 italic">
                    Waiting for player...
                  </span>
                </div>

                {/* Center: Pulsing share icon */}
                <div className="flex flex-col items-center justify-center my-auto py-1">
                  <Share2
                    size={16}
                    className="text-cyan-400/80 group-hover:text-cyan-300 animate-pulse transition-all"
                  />
                </div>
              </div>
            );
          }

          // Occupied in waiting mode (BOT, READY, JOINED NOT READY, OFFLINE)
          return (
            <div
              key={seat.seatIndex}
              className={`relative flex flex-col justify-between p-2 rounded-xl border transition-all duration-300 min-h-[72px] sm:min-h-[80px] select-none ${
                isOffline
                  ? 'bg-slate-900/40 border-slate-700/60 opacity-40 grayscale'
                  : isBot
                  ? 'bg-purple-950/25 border-purple-500/40 shadow-[0_0_12px_rgba(176,38,255,0.15)]'
                  : isReady
                  ? 'bg-slate-900/90 border-emerald-500/60 shadow-[0_0_15px_rgba(52,211,153,0.25)]'
                  : isSeatBlocking
                  ? 'bg-slate-900/60 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-pulse'
                  : 'bg-slate-900/40 border-white/10 opacity-75'
              }`}
            >
              {/* Top Row: Symbol, Identity & Crown, Connection Dot */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs border shadow-sm shrink-0"
                    style={{
                      color: config.hex,
                      borderColor: `${config.hex}55`,
                      backgroundColor: `${config.hex}18`,
                    }}
                  >
                    {seat.symbol}
                  </span>

                  <div className="flex items-center text-slate-300 min-w-0 overflow-hidden">
                    {isBot ? (
                      <Bot size={14} className="text-purple-400 shrink-0" />
                    ) : (
                      <User size={14} className={`${isMySeat ? 'text-cyan-300' : 'text-slate-400'} shrink-0`} />
                    )}
                    {isSeatHost && (
                      <Crown size={11} className="text-amber-400 fill-amber-400 ml-0.5 shrink-0" />
                    )}
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold truncate max-w-[70px] ml-1 ${
                        isMySeat ? 'text-cyan-200' : 'text-slate-300'
                      }`}
                      title={resolvedName}
                    >
                      {resolvedName}
                    </span>
                  </div>
                </div>

                {/* Connection Status Dot */}
                <div className="flex items-center gap-1">
                  {isOffline ? (
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 animate-ping opacity-85" />
                  ) : isBot ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400/80 shadow-[0_0_4px_#34d399]" />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: config.hex,
                        boxShadow: `0 0 6px ${config.hex}`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Bottom Row in Waiting Lobby: Readiness Badge / Host Bot Removal */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.06]">
                <div className="flex items-center gap-1">
                  {isBot ? (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-purple-300">
                      <Check size={12} className="text-emerald-400 stroke-[3]" />
                      <span>BOT</span>
                    </div>
                  ) : isReady ? (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <Check size={12} className="stroke-[3]" />
                      <span>READY</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Circle size={12} strokeWidth={2.5} />
                      <span>WAIT</span>
                    </div>
                  )}
                </div>

                {/* Host button to remove bot */}
                {isHost && isBot && onToggleBot && (
                  <button
                    type="button"
                    onClick={() => onToggleBot(seat.seatIndex, true)}
                    className="p-0.5 rounded text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                    title="Remove Bot"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        }

        // 2. Playing / Finished States
        return (
          <div
            key={seat.seatIndex}
            className={`relative flex flex-col justify-between p-2 rounded-2xl border transition-all duration-300 overflow-hidden ${
              isOffline
                ? 'bg-slate-900/40 border-slate-700/60 opacity-40 grayscale'
                : isTurn
                ? 'bg-slate-900/90 shadow-lg scale-[1.02]'
                : 'bg-slate-900/40 border-white/5 opacity-80'
            }`}
            style={{
              borderColor: isOffline ? undefined : isTurn ? config.hex : undefined,
              boxShadow: isOffline
                ? undefined
                : isTurn
                ? seat.isBot
                  ? `0 0 25px ${config.glow}, inset 0 0 10px ${config.glow}`
                  : `0 0 20px ${config.glow}`
                : undefined,
            }}
          >
            {/* Thin countdown bar around active player card (No text) - human turns only */}
            {isTurn && !seat.isBot && !isOffline && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
                <div
                  className="h-full transition-all duration-100 ease-linear"
                  style={{
                    width: `${timerPercent}%`,
                    backgroundColor: timerPercent < 25 ? '#ef4444' : config.hex,
                    boxShadow: `0 0 8px ${config.hex}`,
                  }}
                />
              </div>
            )}

            {/* Top Row: Symbol, Role, Connection Status Dot */}
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Symbol Badge */}
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm border shadow-sm shrink-0"
                  style={{
                    color: config.hex,
                    borderColor: `${config.hex}55`,
                    backgroundColor: `${config.hex}18`,
                    boxShadow: `0 0 6px ${config.glow}`,
                  }}
                >
                  {seat.symbol}
                </span>

                {/* Identity: Bot or Human */}
                <div className="flex items-center text-slate-300 min-w-0 overflow-hidden">
                  {seat.isBot ? (
                    <div className="flex items-center gap-1">
                      <Bot size={15} className="text-purple-400" />
                      {/* Three pulsing dots thinking indicator (icon-only) */}
                      {isTurn && (
                        <div className="flex items-center gap-0.5 ml-0.5 text-purple-400" title="Bot thinking">
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <User size={14} className={`${isMySeat ? 'text-cyan-300' : 'text-slate-400'} shrink-0`} />
                  )}
                  {isSeatHost && (
                    <Crown size={11} className="text-amber-400 fill-amber-400 ml-0.5 shrink-0" />
                  )}
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold truncate max-w-[70px] ml-1 ${
                      isMySeat ? 'text-cyan-200' : 'text-slate-300'
                    }`}
                    title={resolvedName}
                  >
                    {resolvedName}
                  </span>
                </div>
              </div>

              {/* Connection Status Dot: solid = online, hollow pulsing = offline */}
              <div className="flex items-center gap-1">
                {seat.isBot ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400/80 shadow-[0_0_4px_#34d399]" />
                ) : seat.isConnected ? (
                  <span
                    className="w-2 h-2 rounded-full shadow-sm"
                    style={{
                      backgroundColor: config.hex,
                      boxShadow: `0 0 6px ${config.hex}`,
                    }}
                  />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 animate-ping opacity-75" />
                )}
              </div>
            </div>

            {/* Bottom Row: Marks queue */}
            <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/[0.04]">
              {/* Mark Age Dots (up to 3 marks) */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((idx) => {
                  const active = idx < moves.length;
                  const isOldestOfThree = moves.length === 3 && idx === 0;

                  return (
                    <span
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                        active
                          ? isOldestOfThree
                            ? 'border border-red-400 animate-ping bg-transparent'
                            : ''
                          : 'bg-slate-800 border border-white/10'
                      }`}
                      style={{
                        backgroundColor: active && !isOldestOfThree ? config.hex : undefined,
                        boxShadow: active && !isOldestOfThree ? `0 0 4px ${config.hex}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
