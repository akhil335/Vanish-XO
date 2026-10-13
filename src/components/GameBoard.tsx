'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState, getMarkAgeIndex } from '@/lib/game';
import { MarkIcon } from './MarkIcon';
import { ParticleDissolve } from './ParticleDissolve';

interface GameBoardProps {
  state: GameState;
  onCellClick: (index: number) => void;
  isBotThinking?: boolean;
  vanishedAnim: { cell: number; player: 'X' | 'O'; id: number } | null;
  onVanishedAnimComplete: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  state,
  onCellClick,
  isBotThinking = false,
  vanishedAnim,
  onVanishedAnimComplete,
}) => {
  const { board, turn, winner, winningLine } = state;

  // Board edge glow based on active turn (No turn text!)
  const boardTurnGlowClass =
    winner !== null
      ? 'border-yellow-500/50 shadow-yellow-500/20'
      : turn === 'X'
      ? 'border-cyan-500/70 shadow-[0_0_30px_rgba(0,240,255,0.25)]'
      : 'border-pink-500/70 shadow-[0_0_30px_rgba(255,0,127,0.25)]';

  return (
    <div className="relative w-full max-w-[360px] aspect-square mx-auto p-2 sm:p-3">
      {/* Dynamic Ambient Edge Glow Aura */}
      <div
        className={`absolute inset-0 rounded-3xl transition-all duration-500 pointer-events-none blur-xl opacity-30 ${
          winner !== null
            ? 'bg-yellow-400'
            : turn === 'X'
            ? 'bg-cyan-400'
            : 'bg-pink-500'
        }`}
      />

      {/* Main Grid Frame */}
      <div
        className={`relative w-full h-full rounded-3xl p-3 bg-[#0a0d17]/90 backdrop-blur-md border-2 transition-all duration-300 grid grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3.5 ${boardTurnGlowClass}`}
      >
        {Array.from({ length: 9 }).map((_, index) => {
          const mark = board[index];
          const isWinningCell = winningLine ? winningLine.includes(index) : false;
          const isDimmed = winner !== null && !isWinningCell;
          const ageInfo = getMarkAgeIndex(state, index);
          const isVanishingHere = vanishedAnim && vanishedAnim.cell === index;

          const isClickable =
            !mark && !winner && !isBotThinking;

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
                  className={`w-2.5 h-2.5 rounded-full opacity-0 hover:opacity-40 transition-opacity duration-200 pointer-events-none ${
                    turn === 'X' ? 'bg-cyan-400 shadow-cyan-400' : 'bg-pink-500 shadow-pink-500'
                  }`}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
