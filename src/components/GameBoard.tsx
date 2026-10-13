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

  // Calculate grid size from board length (3x3 = 9, 5x5 = 25, 6x6 = 36)
  const totalCells = board.length;
  const gridSize = Math.round(Math.sqrt(totalCells)) || 3;

  // Sizing & padding adaptation based on grid dimensions
  const maxWidthClass = gridSize === 6 ? 'max-w-[440px]' : gridSize === 5 ? 'max-w-[400px]' : 'max-w-[360px]';
  const gapClass = gridSize >= 6 ? 'gap-1.5 sm:gap-2' : gridSize === 5 ? 'gap-2 sm:gap-2.5' : 'gap-2.5 sm:gap-3.5';
  const cellRoundedClass = gridSize >= 6 ? 'rounded-lg sm:rounded-xl' : gridSize === 5 ? 'rounded-xl' : 'rounded-2xl';
  const markSize = gridSize >= 5 ? 'sm' : 'md';

  // Board edge glow based on active turn (No turn text!)
  const boardBorderColor = winner !== null ? '#ffd700' : turnConfig.hex;
  const boardShadowGlow =
    winner !== null
      ? '0 0 35px rgba(255, 215, 0, 0.35)'
      : `0 0 30px ${turnConfig.glow}`;

  return (
    <div className={`relative w-full ${maxWidthClass} aspect-square mx-auto p-2 sm:p-3 select-none transition-all duration-300`}>
      {/* Dynamic Ambient Edge Glow Aura */}
      <div
        className="absolute inset-0 rounded-3xl transition-all duration-500 pointer-events-none blur-xl opacity-35"
        style={{
          backgroundColor: winner !== null ? '#ffd700' : turnConfig.hex,
        }}
      />

      {/* Main Grid Frame */}
      <div
        className={`relative w-full h-full rounded-3xl p-2.5 sm:p-3 bg-[#0a0d17]/90 backdrop-blur-md border-2 transition-all duration-300 grid ${gapClass}`}
        style={{
          borderColor: boardBorderColor,
          boxShadow: boardShadowGlow,
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {board.map((mark, index) => {
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
              className={`relative flex items-center justify-center ${cellRoundedClass} transition-all duration-200 select-none overflow-hidden touch-manipulation cursor-pointer ${
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
                  size={markSize}
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
                  className="w-2 h-2 rounded-full opacity-0 hover:opacity-40 transition-opacity duration-200 pointer-events-none"
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
