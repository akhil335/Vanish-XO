'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, User, Bot, X, Search } from 'lucide-react';

export interface MatchFoundData {
  roomCode: string;
  token?: string;
  seatIndex: number;
  seatsCount: 2 | 3 | 4;
  startingSeatIndex: number;
  botSeats: number[];
}

interface MatchmakingModalProps {
  targetCount: 2 | 3 | 4;
  currentCount: number;
  totalSearching: number;
  matchResult: MatchFoundData | null;
  onCancel: () => void;
  onCountdownComplete: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  targetCount,
  currentCount,
  totalSearching,
  matchResult,
  onCancel,
  onCountdownComplete,
}) => {
  const [countdown, setCountdown] = useState<number>(2);

  // Countdown timer when match is found
  useEffect(() => {
    if (!matchResult) {
      return;
    }

    const timer1 = setTimeout(() => {
      setCountdown(1);
    }, 1000);

    const timer2 = setTimeout(() => {
      setCountdown(0);
      onCountdownComplete();
    }, 2000);

    return () => {
      setCountdown(2);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [matchResult, onCountdownComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
      >
        <motion.div
          initial={{ scale: 0.85, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: 15, opacity: 0 }}
          className="relative max-w-xs w-full bg-[#0a0d16] border border-cyan-500/40 rounded-3xl p-6 flex flex-col items-center gap-6 shadow-2xl overflow-hidden"
          style={{
            boxShadow: matchResult
              ? '0 0 40px rgba(0, 240, 255, 0.4)'
              : '0 0 30px rgba(0, 240, 255, 0.2)',
          }}
        >
          {/* Ambient Searching Pulse Glow */}
          <div
            className={`absolute inset-0 rounded-3xl opacity-20 blur-xl pointer-events-none transition-all duration-500 ${
              matchResult ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'
            }`}
          />

          {/* Top Bar: Target Count Icon + Searching Count (Icon + Number only) + Cancel X */}
          <div className="relative z-10 w-full flex items-center justify-between">
            {/* Player count icon badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 font-mono text-xs font-black text-cyan-400">
              <Users size={14} />
              <span>{targetCount}P</span>
            </div>

            {/* Total searching indicator (icon + number only) */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-900/60 border border-white/5 text-slate-400 text-xs font-mono">
              <Search size={12} className="text-cyan-400 animate-spin" />
              <span>{totalSearching}</span>
            </div>

            {/* Cancel (X) button */}
            <button
              type="button"
              id="cancel-matchmaking-btn"
              onClick={onCancel}
              disabled={Boolean(matchResult)}
              aria-label="Cancel searching"
              className="p-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X size={16} />
            </button>
          </div>

          {/* Center: Slots representation */}
          <div className="relative z-10 flex items-center justify-center gap-3 my-2">
            {Array.from({ length: targetCount }).map((_, index) => {
              // If match is found:
              if (matchResult) {
                const isBotSlot = matchResult.botSeats.includes(index);
                const isMySlot = matchResult.seatIndex === index;

                return (
                  <motion.div
                    key={index}
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300, delay: index * 0.1 }}
                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                      isBotSlot
                        ? 'bg-purple-950/70 border-purple-400/80 shadow-[0_0_15px_rgba(176,38,255,0.4)]'
                        : isMySlot
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.6)]'
                        : 'bg-emerald-950/70 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]'
                    }`}
                  >
                    {isBotSlot ? (
                      <Bot size={22} className="text-purple-300" />
                    ) : (
                      <User size={22} className={isMySlot ? 'text-cyan-300' : 'text-emerald-300'} />
                    )}
                  </motion.div>
                );
              }

              // Searching state:
              const isFilled = index < currentCount;

              return (
                <div
                  key={index}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isFilled
                      ? 'bg-cyan-950/80 border border-cyan-400 shadow-[0_0_14px_rgba(0,240,255,0.5)]'
                      : 'border-2 border-dashed border-cyan-500/30 bg-slate-900/30 animate-pulse'
                  }`}
                >
                  {isFilled ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <User size={22} className="text-cyan-300" />
                    </motion.div>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-cyan-500/30 animate-ping" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Countdown or Searching Radar */}
          <div className="relative z-10 w-full flex flex-col items-center gap-1">
            {matchResult ? (
              <motion.div
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-10 h-10 rounded-full flex items-center justify-center font-black font-mono text-xl text-emerald-400 bg-emerald-500/10 border border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.4)]"
              >
                {countdown}
              </motion.div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping delay-150" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping delay-300" />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
