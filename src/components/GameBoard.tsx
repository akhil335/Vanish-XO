'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GameState, getMarkAgeIndex, getMarkAgeForSymbol, getWinLineGeometry } from '@/lib/game';
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
  onWinLineComplete?: () => void;
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
  onWinLineComplete,
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

  const gridRef = useRef<HTMLDivElement | null>(null);
  const isWinActive = Boolean(winner && winningLine);
  const [winLineAnimated, setWinLineAnimated] = useState(false);
  const [winLineCompleted, setWinLineCompleted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const canDrawLine = isWinActive && (isReplay || winLineAnimated);
  const lineDrawn = isWinActive && (isReplay || winLineCompleted);

  // Sequence win line drawing:
  // Order of events on a win: placement animation, then vanish dissolve if one happened on same move,
  // then the line draws, then the other marks dim and winner icon/confetti appear.
  useEffect(() => {
    if (!isWinActive || isReplay) return;

    // Live win:
    const hadVanish = Boolean(
      vanishedAnim ||
      state?.lastVanished ||
      roomState?.lastVanished
    );
    const delayBeforeLine = hadVanish ? 520 : 260;

    const timer = setTimeout(() => {
      setWinLineAnimated(true);
    }, delayBeforeLine);

    return () => {
      clearTimeout(timer);
      setWinLineAnimated(false);
      setWinLineCompleted(false);
    };
  }, [isWinActive, isReplay, vanishedAnim, state?.lastVanished, roomState?.lastVanished]);

  // Actual rendered cell rectangles measurement
  const [renderedLineCoords, setRenderedLineCoords] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const updateRenderedCoords = useCallback(() => {
    if (!winningLine || !gridRef.current) {
      setRenderedLineCoords(null);
      return;
    }
    const geo = getWinLineGeometry(winningLine, gridSize);
    const el1 = document.getElementById(`cell-${geo.startCell}`);
    const el2 = document.getElementById(`cell-${geo.endCell}`);
    const gridEl = gridRef.current;
    if (el1 && el2 && gridEl) {
      const r1 = el1.getBoundingClientRect();
      const r2 = el2.getBoundingClientRect();
      const g = gridEl.getBoundingClientRect();

      if (r1.width > 0 && r2.width > 0 && g.width > 0) {
        const c1x = r1.left + r1.width / 2 - g.left;
        const c1y = r1.top + r1.height / 2 - g.top;
        const c2x = r2.left + r2.width / 2 - g.left;
        const c2y = r2.top + r2.height / 2 - g.top;

        const dx = c2x - c1x;
        const dy = c2y - c1y;
        const dist = Math.hypot(dx, dy);
        const extend = r1.width * 0.42;

        if (dist > 0) {
          const ux = dx / dist;
          const uy = dy / dist;
          setRenderedLineCoords({
            x1: c1x - ux * extend,
            y1: c1y - uy * extend,
            x2: c2x + ux * extend,
            y2: c2y + uy * extend,
          });
          return;
        }
      }
    }
    setRenderedLineCoords(null);
  }, [winningLine, gridSize]);

  useEffect(() => {
    updateRenderedCoords();
    if (!gridRef.current) return;
    const ro = new ResizeObserver(() => {
      updateRenderedCoords();
    });
    ro.observe(gridRef.current);
    window.addEventListener('resize', updateRenderedCoords);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateRenderedCoords);
    };
  }, [updateRenderedCoords]);

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
        ref={gridRef}
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
          // Marks only dim once the win line has fully finished drawing (or in Replay)
          const isDimmed = (lineDrawn || isReplay) && winner !== null && !isWinningCell;
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
              className={`relative flex items-center justify-center ${cellRoundedClass} transition-all duration-200 select-none overflow-hidden touch-manipulation ${
                mark
                  ? 'bg-slate-900/60 border border-white/5'
                  : 'bg-slate-900/30 border border-white/[0.04] hover:border-white/20 active:bg-slate-800/40'
              } ${
                isClickable
                  ? 'cursor-pointer'
                  : disabled && !mark && !winner
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-default'
              }`}
            >
              {/* Winning Cell Glow */}
              {isWinningCell && winnerConfig && (
                <motion.div
                  initial={{ opacity: effectiveIsGameOver && !isReplay && !lineDrawn ? 0.2 : 1 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: effectiveIsGameOver && !isReplay ? 0.3 : 0,
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
                    duration: 0.35,
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

        {/* Strike Line Overlay across winning cells (Pen stroke animation in winner's color with glow) */}
        {canDrawLine && winningLine && winnerConfig && (() => {
          const fallbackGeo = getWinLineGeometry(winningLine, gridSize);
          const coords = renderedLineCoords || {
            x1: fallbackGeo.x1,
            y1: fallbackGeo.y1,
            x2: fallbackGeo.x2,
            y2: fallbackGeo.y2,
          };
          const lineLength = Math.hypot(coords.x2 - coords.x1, coords.y2 - coords.y1) || 100;
          const strokeWidth = renderedLineCoords
            ? (gridSize >= 5 ? 5 : 6.5)
            : (gridSize >= 5 ? 1.6 : 2.2);
          const coreWidth = renderedLineCoords
            ? (gridSize >= 5 ? 2 : 2.5)
            : (gridSize >= 5 ? 0.6 : 0.8);
          const animDuration = prefersReducedMotion || isReplay ? 0 : 0.5;

          return (
            <div
              className={`absolute pointer-events-none z-30 ${
                renderedLineCoords ? 'inset-0' : 'inset-2.5 sm:inset-3'
              }`}
            >
              <svg
                className="w-full h-full overflow-visible pointer-events-none"
                viewBox={renderedLineCoords ? undefined : '0 0 100 100'}
                preserveAspectRatio="none"
              >
                {/* Glowing Outer Stroke */}
                <motion.line
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke={winnerConfig.hex}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={lineLength}
                  initial={{ strokeDashoffset: animDuration === 0 ? 0 : lineLength }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: animDuration,
                    ease: 'easeOut',
                  }}
                  style={{
                    filter: `drop-shadow(0 0 8px ${winnerConfig.hex}) drop-shadow(0 0 16px ${winnerConfig.glow})`,
                  }}
                  onAnimationComplete={() => {
                    setWinLineCompleted(true);
                    onWinLineComplete?.();
                  }}
                />
                {/* Crisp Neon Inner Core */}
                <motion.line
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#ffffff"
                  strokeWidth={coreWidth}
                  strokeLinecap="round"
                  strokeDasharray={lineLength}
                  initial={{ strokeDashoffset: animDuration === 0 ? 0 : lineLength }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: animDuration,
                    ease: 'easeOut',
                  }}
                  className="opacity-80"
                />
              </svg>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
