'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState, getMarkAgeIndex, getMarkAgeForSymbol } from '@/lib/game';
import { MarkSymbol, RoomState, SEAT_COLORS } from '@/lib/types';
import { MarkIcon } from './MarkIcon';
import { ParticleDissolve } from './ParticleDissolve';

interface GameBoardProps {
  state?: GameState;
  roomState?: RoomState;
  onCellClick: (index: number) => void;
  disabled?: boolean;
  vanishedAnim: { cell: number; player: MarkSymbol; id: number } | null;
  onVanishedAnimComplete: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  state,
  roomState,
  onCellClick,
  disabled = false,
  vanishedAnim,
  onVanishedAnimComplete,
}) => {
  const board = state ? state.board : roomState ? roomState.board : Array(9).fill(null);
  const winner = state ? state.winner : roomState ? roomState.winner : null;
  const winningLine = state ? state.winningLine : roomState ? roomState.winningLine : null;

  const currentTurnSymbol: MarkSymbol = state
    ? state.turn
    : roomState
    ? roomState.seats[roomState.turnSeatIndex]?.symbol || 'X'
    : 'X';

  const turnConfig = SEAT_COLORS[currentTurnSymbol] || SEAT_COLORS.X;

  const getAge = (cellIndex: number) => {
    if (state) {
      const res = getMarkAgeIndex(state, cellIndex);
      return res ? { symbol: res.player as MarkSymbol, ageIndex: res.ageIndex, isOldestOfThree: res.isOldestOfThree } : null;
    }
    if (roomState) {
      return getMarkAgeForSymbol(roomState, cellIndex);
    }
    return null;
  };

  // Board edge glow based on active turn (No turn text!)
  const boardBorderColor = winner !== null ? '#ffd700' : turnConfig.hex;
  const boardShadowGlow =
    winner !== null
      ? '0 0 35px rgba(255, 215, 0, 0.35)'
      : `0 0 30px ${turnConfig.glow}`;

  return (
    <div className="relative w-full max-w-[360px] aspect-square mx-auto p-2 sm:p-3 select-none">
      {/* Dynamic Ambient Edge Glow Aura */}
      <div
        className="absolute inset-0 rounded-3xl transition-all duration-500 pointer-events-none blur-xl opacity-35"
        style={{
          backgroundColor: winner !== null ? '#ffd700' : turnConfig.hex,
        }}
      />

      {/* Main Grid Frame */}
      <div
        className="relative w-full h-full rounded-3xl p-3 bg-[#0a0d17]/90 backdrop-blur-md border-2 transition-all duration-300 grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3.5"
        style={{
          borderColor: boardBorderColor,
          boxShadow: boardShadowGlow,
        }}
      >
        {Array.from({ length: 9 }).map((_, index) => {
          const mark = board[index];
          const isWinningCell = winningLine ? winningLine.includes(index) : false;
          const isDimmed = winner !== null && !isWinningCell;
          const ageInfo = getAge(index);
          const isVanishingHere = vanishedAnim && vanishedAnim.cell === index;

          const isClickable = !mark && !winner && !disabled;

          return (
            <motion.button
              key={index}
              type="button"
              id={`cell-${index}`}
              aria-label={`Cell ${index + 1}`}
              disabled={!isClickable}
              onClick={() => onCellClick(index)}
              whileHover={isClickable ? { scale: 1.02, backgroundColor: 'rgba(30, 41, 59, 0.7)' } : {}}
              whileTap={isClickable ? { scale: 0.96 } : {}}
              className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 select-none overflow-hidden touch-manipulation cursor-pointer ${
                mark
                  ? 'bg-slate-900/60 border border-white/5'
                  : 'bg-slate-900/30 border border-white/[0.04] hover:border-white/20 active:bg-slate-800/40'
              } ${
                isWinningCell
                  ? 'bg-yellow-500/10 border-yellow-400/80 shadow-[0_0_20px_rgba(255,215,0,0.35)]'
                  : ''
              } ${!isClickable && !mark ? 'cursor-default' : ''}`}
            >
              {/* Existing Mark */}
              {mark && (
                <MarkIcon
                  player={mark}
                  ageIndex={ageInfo?.ageIndex}
                  isOldestOfThree={ageInfo?.isOldestOfThree}
                  isWinning={isWinningCell}
                  isDimmed={isDimmed}
                  size="md"
                />
              )}

              {/* Particle Dissolve Burst when a mark vanishes */}
              {isVanishingHere && (
                <ParticleDissolve
                  player={vanishedAnim.player}
                  onComplete={onVanishedAnimComplete}
                />
              )}

              {/* Empty Cell Hover preview hint for current player */}
              {isClickable && (
                <div
                  className="w-2.5 h-2.5 rounded-full opacity-0 hover:opacity-40 transition-opacity duration-200 pointer-events-none"
                  style={{
                    backgroundColor: turnConfig.hex,
                    boxShadow: `0 0 8px ${turnConfig.hex}`,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
