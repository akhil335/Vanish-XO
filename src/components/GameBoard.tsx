'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState, getMarkAgeIndex, getMarkAgeForSymbol } from '@/lib/game';
import { MarkSymbol, RoomState, SEAT_COLORS } from '@/lib/types';
import { MarkIcon } from './MarkIcon';
import { ParticleDissolve } from './ParticleDissolve';
import { Wind } from 'lucide-react';

export interface GameBoardProps {
  state?: GameState;
  roomState?: RoomState;
  onCellClick: (index: number) => void;
  disabled?: boolean;
  vanishedAnim: { cell: number; player: MarkSymbol; id: number } | null;
  onVanishedAnimComplete: () => void;
  lastMoveCell?: number | null;
  ghostVanish?: { symbol: MarkSymbol; cell: number } | null;
  isGameOver?: boolean;
  winningLineOverride?: [number, number, number] | null;
  winnerOverride?: MarkSymbol | null;
  boardOverride?: (MarkSymbol | null)[];
  isReplay?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  state,
  roomState,
  onCellClick,
  disabled = false,
  vanishedAnim,
  onVanishedAnimComplete,
  lastMoveCell,
  ghostVanish,
  isGameOver = false,
  winningLineOverride,
  winnerOverride,
  boardOverride,
  isReplay = false,
}) => {
  const board = boardOverride
    ? boardOverride
    : state
    ? state.board
    : roomState
    ? roomState.board
    : Array(9).fill(null);

  const winner = winnerOverride !== undefined
    ? winnerOverride
    : state
    ? state.winner
    : roomState
    ? roomState.winner
    : null;

  const winningLine = winningLineOverride !== undefined
    ? winningLineOverride
    : state
    ? state.winningLine
    : roomState
    ? roomState.winningLine
    : null;

  // Derive last placed cell and vanished ghost if not passed explicitly
  const effectiveLastMoveCell = lastMoveCell !== undefined
    ? lastMoveCell
    : state?.lastMoveCell !== undefined
    ? state.lastMoveCell
    : roomState?.lastMoveCell !== undefined
    ? roomState.lastMoveCell
    : null;

  const effectiveGhostVanish = ghostVanish !== undefined
    ? ghostVanish
    : state?.lastVanished
    ? { symbol: state.lastVanished.player as MarkSymbol, cell: state.lastVanished.cell }
    : roomState?.lastVanished
    ? { symbol: roomState.lastVanished.symbol, cell: roomState.lastVanished.cell }
    : null;

  const effectiveIsGameOver = isGameOver || winner !== null;

  const currentTurnSymbol: MarkSymbol = state
    ? state.turn
    : roomState
    ? roomState.seats[roomState.turnSeatIndex]?.symbol || 'X'
    : 'X';

  const turnConfig = SEAT_COLORS[currentTurnSymbol] || SEAT_COLORS.X;

  const getAge = (cellIndex: number) => {
    if (boardOverride) {
      // In replay step, calculate simple age
      return null;
    }
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
  const maxDimensionPx = gridSize === 6 ? 440 : gridSize === 5 ? 400 : 360;
  const gapClass = gridSize >= 6 ? 'gap-1.5 sm:gap-2' : gridSize === 5 ? 'gap-2 sm:gap-2.5' : 'gap-2.5 sm:gap-3.5';
  const cellRoundedClass = gridSize >= 6 ? 'rounded-lg sm:rounded-xl' : gridSize === 5 ? 'rounded-xl' : 'rounded-2xl';
  const markSize = gridSize >= 5 ? 'sm' : 'md';

  const winnerConfig = winner ? (SEAT_COLORS[winner] || SEAT_COLORS.X) : null;

  // Board edge glow based on active turn / winner (uses winner's authentic neon color)
  const boardBorderColor = winnerConfig ? winnerConfig.hex : turnConfig.hex;
  const boardShadowGlow = winnerConfig
    ? `0 0 35px ${winnerConfig.glow}`
    : `0 0 30px ${turnConfig.glow}`;

  // Clamped responsive sizing: always visible without scrolling across desktop & mobile
  const boardMaxSizeStyle = {
    maxWidth: `min(calc(100vw - 20px), calc(100dvh - 200px), ${maxDimensionPx}px)`,
    maxHeight: `min(calc(100vw - 20px), calc(100dvh - 200px), ${maxDimensionPx}px)`,
  };

  return (
    <div
      className="relative w-full aspect-square mx-auto p-1.5 sm:p-2.5 select-none transition-all duration-300"
      style={boardMaxSizeStyle}
    >
      {/* Dynamic Ambient Edge Glow Aura */}
      <div
        className="absolute inset-0 rounded-3xl transition-all duration-500 pointer-events-none blur-xl opacity-35"
        style={{
          backgroundColor: winnerConfig ? winnerConfig.hex : turnConfig.hex,
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
          const isPlacedCell = effectiveLastMoveCell === index;
          const isGhostCell = Boolean(
            effectiveGhostVanish &&
            effectiveGhostVanish.cell === index &&
            (!mark || isReplay)
          );

          const isClickable = !mark && !winner && !disabled && !isReplay;

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
              } ${!isClickable && !mark ? 'cursor-default' : ''}`}
            >
              {/* Winning Line Highlighting with 1s start animation sequence */}
              {isWinningCell && winnerConfig && (
                <motion.div
                  initial={{ opacity: effectiveIsGameOver && !isReplay ? 0.2 : 1 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: effectiveIsGameOver && !isReplay ? 0.65 : 0,
                    duration: 0.35,
                    ease: 'easeOut',
                  }}
                  className="absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none z-10"
                  style={{
                    backgroundColor: `${winnerConfig.hex}22`,
                    borderColor: `${winnerConfig.hex}`,
                    borderWidth: 2,
                    boxShadow: `0 0 25px ${winnerConfig.hex}, inset 0 0 15px ${winnerConfig.glow}`,
                  }}
                />
              )}

              {/* Bright Ring marking the Final Placement cell */}
              {isPlacedCell && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    scale: [0.85, 1.1, 1.0],
                    opacity: 1,
                  }}
                  transition={{
                    delay: effectiveIsGameOver && !isReplay ? 0.35 : 0,
                    duration: 0.4,
                    ease: 'easeOut',
                  }}
                  className="absolute inset-1 sm:inset-1.5 rounded-xl sm:rounded-2xl border-2 pointer-events-none z-20"
                  style={{
                    borderColor: '#ffffff',
                    boxShadow: '0 0 16px rgba(255, 255, 255, 0.95), inset 0 0 8px rgba(255, 255, 255, 0.5)',
                  }}
                />
              )}

              {/* Ghost Outline in cell where mark vanished, with small "fade" icon */}
              {isGhostCell && effectiveGhostVanish && !mark && (
                <motion.div
                  initial={{ opacity: effectiveIsGameOver && !isReplay ? 0.85 : 0.35, scale: 0.95 }}
                  animate={{ opacity: 0.28, scale: 0.88 }}
                  transition={{
                    duration: effectiveIsGameOver && !isReplay ? 0.45 : 0.2,
                    ease: 'easeOut',
                  }}
                  className="relative flex items-center justify-center w-full h-full pointer-events-none z-10"
                >
                  <div className="opacity-70 filter blur-[0.2px]">
                    <MarkIcon
                      player={effectiveGhostVanish.symbol}
                      size={markSize}
                      isDimmed={false}
                    />
                  </div>
                  {/* Small "fade" icon indicator badge */}
                  <div
                    className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-black uppercase text-slate-300 shadow-md"
                    title="Vanished mark"
                  >
                    <Wind size={10} className="text-cyan-300" />
                    <span className="tracking-tighter">FADE</span>
                  </div>
                </motion.div>
              )}

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

              {/* Vanish Warning: bright dashed outline in owner's color & pulse */}
              {mark && ageInfo?.isOldestOfThree && !isWinningCell && (
                <motion.div
                  animate={{
                    opacity: [0.75, 1, 0.75],
                    scale: [0.97, 1.01, 0.97],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-1 sm:inset-1.5 rounded-xl sm:rounded-2xl border-2 border-dashed pointer-events-none z-20"
                  style={{
                    borderColor: SEAT_COLORS[mark as MarkSymbol]?.hex || '#00f0ff',
                    boxShadow: `0 0 14px ${SEAT_COLORS[mark as MarkSymbol]?.glow || 'rgba(0,240,255,0.7)'}, inset 0 0 8px ${SEAT_COLORS[mark as MarkSymbol]?.glow || 'rgba(0,240,255,0.5)'}`,
                  }}
                />
              )}

              {/* Small "fade" icon in the corner for the oldest of 3 */}
              {mark && ageInfo?.isOldestOfThree && !isWinningCell && (
                <div
                  className="absolute top-1 right-1 flex items-center justify-center p-0.5 rounded-md bg-black/90 border pointer-events-none z-20 shadow-md"
                  style={{ borderColor: `${SEAT_COLORS[mark as MarkSymbol]?.hex || '#00f0ff'}bb` }}
                  title="Vanishes next"
                >
                  <Wind size={11} style={{ color: SEAT_COLORS[mark as MarkSymbol]?.hex || '#00f0ff' }} />
                </div>
              )}

              {/* Particle Dissolve Burst when a mark vanishes during live play */}
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
