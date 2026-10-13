'use client';

import React, { useEffect, useState } from 'react';
import { Bot, User, Crown, Check } from 'lucide-react';
import { RoomState, PlayerSeat, SEAT_COLORS } from '@/lib/types';

interface OnlinePlayerBarProps {
  roomState: RoomState;
  mySeatIndex: number | null; // which seat belongs to local player, or null if spectator
  isHost: boolean;
  onToggleBot?: (seatIndex: number, currentIsBot: boolean) => void;
  onToggleReady?: (ready: boolean) => void;
}

export const OnlinePlayerBar: React.FC<OnlinePlayerBarProps> = ({
  roomState,
  mySeatIndex,
  isHost,
  onToggleBot,
  onToggleReady,
}) => {
  const [now, setNow] = useState<number>(0);

  // High-frequency tick for smooth countdown bar animation
  useEffect(() => {
    if (roomState.status !== 'playing') return;
    const update = () => setNow(Date.now());
    const timer = setTimeout(update, 0);
    const interval = setInterval(update, 100);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [roomState.status, roomState.turnStartedAt]);

  const { seats, seatsCount, turnSeatIndex, turnStartedAt, turnDurationMs, status, playerMoves } = roomState;

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
        const isTurn = status === 'playing' && turnSeatIndex === seat.seatIndex;
        const config = SEAT_COLORS[seat.symbol] || SEAT_COLORS.X;

        // Turn timer countdown calculation (20s)
        let timerPercent = 100;
        if (isTurn && status === 'playing') {
          const elapsed = Math.max(0, now - turnStartedAt);
          const remaining = Math.max(0, turnDurationMs - elapsed);
          timerPercent = Math.min(100, (remaining / turnDurationMs) * 100);
        }

        const moves = playerMoves[seat.symbol] || [];

        return (
          <div
            key={seat.seatIndex}
            className={`relative flex flex-col justify-between p-2 rounded-2xl border transition-all duration-300 overflow-hidden ${
              isTurn
                ? 'bg-slate-900/90 shadow-lg scale-[1.02]'
                : 'bg-slate-900/40 border-white/5 opacity-80'
            }`}
            style={{
              borderColor: isTurn ? config.hex : undefined,
              boxShadow: isTurn ? `0 0 20px ${config.glow}` : undefined,
            }}
          >
            {/* Thin countdown bar around active player card (No text) */}
            {isTurn && (
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
              <div className="flex items-center gap-1.5">
                {/* Symbol Badge */}
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm border shadow-sm"
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
                <div className="flex items-center text-slate-300">
                  {seat.isBot ? (
                    <Bot size={14} className="text-slate-400" />
                  ) : (
                    <User size={14} className={isMySeat ? 'text-cyan-300' : 'text-slate-400'} />
                  )}
                  {seat.seatIndex === 0 && (
                    <Crown size={11} className="text-amber-400 ml-0.5" />
                  )}
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

            {/* Bottom Row: Marks queue & Ready / Bot toggle button */}
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

              {/* Lobby Waiting Controls */}
              {status === 'waiting' && (
                <div className="flex items-center gap-1">
                  {/* Host can toggle Bot on empty seats */}
                  {isHost && seat.seatIndex !== 0 && !seat.playerId && onToggleBot && (
                    <button
                      type="button"
                      onClick={() => onToggleBot(seat.seatIndex, seat.isBot)}
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                        seat.isBot
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-400 border border-white/10 hover:text-slate-200'
                      }`}
                    >
                      {seat.isBot ? 'BOT' : '+BOT'}
                    </button>
                  )}

                  {/* Ready Indicator or Ready Toggle Button */}
                  {isMySeat ? (
                    <button
                      type="button"
                      onClick={() => onToggleReady && onToggleReady(!seat.isReady)}
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded cursor-pointer transition-all ${
                        seat.isReady
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse'
                      }`}
                    >
                      {seat.isReady ? 'READY' : 'GO'}
                    </button>
                  ) : (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        seat.isReady || seat.isBot
                          ? 'text-emerald-400'
                          : seat.playerId
                          ? 'text-amber-400 animate-pulse'
                          : 'text-slate-600'
                      }`}
                    >
                      {seat.isReady || seat.isBot ? (
                        <Check size={10} className="inline text-emerald-400" />
                      ) : seat.playerId ? (
                        '...'
                      ) : (
                        'OPEN'
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
