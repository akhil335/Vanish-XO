'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { MarkSymbol, MoveRecord, SEAT_COLORS } from '@/lib/types';
import { MarkIcon } from './MarkIcon';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { track } from '@/lib/analytics';
import {
  RotateCcw,
  Home,
  Compass,
  Trophy,
  XCircle,
  Crown,
  History,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
} from 'lucide-react';
import { getMoveInsights, MoveInsight } from '@/lib/game';

export type GameOutcome = 'win' | 'lose' | 'spectator';

export interface GameOverBannerProps {
  winner: MarkSymbol | null;
  outcome?: GameOutcome;
  mySymbol?: MarkSymbol | null;
  isReplay?: boolean;
  replayMove?: MoveRecord | null;
  replayStepIndex?: number;
  totalReplaySteps?: number;
  isReplayTrap?: boolean;
  hadVanish?: boolean;
}

export const GameOverBanner: React.FC<GameOverBannerProps> = ({
  winner,
  outcome = 'spectator',
  mySymbol,
  isReplay = false,
  replayMove,
  replayStepIndex = 0,
  totalReplaySteps = 0,
  isReplayTrap = false,
  hadVanish = false,
}) => {
  const isWinner = outcome === 'win';
  const isLoser = outcome === 'lose';
  const isSpectator = outcome === 'spectator';

  const [hasDelayedShown, setHasDelayedShown] = React.useState(false);
  const readyToShow = Boolean(winner && (isReplay || hasDelayedShown));

  React.useEffect(() => {
    if (!winner || isReplay) return;

    // Wait for placement + vanish dissolve (if any) + pen stroke line draw (~500ms)
    const delay = hadVanish ? 1040 : 760;
    const timer = setTimeout(() => {
      setHasDelayedShown(true);
    }, delay);
    return () => {
      clearTimeout(timer);
      setHasDelayedShown(false);
    };
  }, [winner, isReplay, hadVanish]);

  // Confetti effect on game over (bursts from sides, only after line has finished drawing)
  useEffect(() => {
    if (!winner || isReplay || !readyToShow) return;

    if (isLoser) {
      soundManager.playLose();
      triggerHaptic('lose');
      return;
    }

    soundManager.playWin();
    triggerHaptic('win');

    const config = SEAT_COLORS[winner] || SEAT_COLORS.X;
    const colors = [config.hex, '#ffffff', '#ffd700'];

    const duration = 1.8 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      // Confetti placed above and at sides
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 50,
        origin: { x: 0.05, y: 0.15 },
        colors,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 50,
        origin: { x: 0.95, y: 0.15 },
        colors,
        disableForReducedMotion: true,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [winner, isLoser, isReplay, readyToShow]);

  if ((!winner && !isReplay) || (!readyToShow && !isReplay)) return null;

  const winnerConfig = winner ? (SEAT_COLORS[winner] || SEAT_COLORS.X) : SEAT_COLORS.X;

  // REPLAY BANNER MODE
  if (isReplay && replayMove) {
    const playerConfig = SEAT_COLORS[replayMove.player] || SEAT_COLORS.X;

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[360px] mx-auto flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-lg"
      >
        <div className="flex items-center gap-2">
          {/* Active Player Icon glowing */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center p-1 border transition-all"
            style={{
              borderColor: `${playerConfig.hex}66`,
              backgroundColor: `${playerConfig.hex}18`,
              boxShadow: `0 0 12px ${playerConfig.glow}`,
            }}
          >
            <MarkIcon player={replayMove.player} size="sm" />
          </div>
          <div className="flex flex-col">
            <span
              className="text-xs font-black tracking-wider uppercase"
              style={{ color: playerConfig.hex, textShadow: playerConfig.textGlow }}
            >
              {replayMove.player} MOVED
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
              STEP {replayStepIndex + 1} / {totalReplaySteps}
            </span>
          </div>
        </div>

        {/* Trap Warning Pill if this move missed block or opened opponent win */}
        {isReplayTrap ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-black shadow-[0_0_10px_rgba(245,158,11,0.3)]"
          >
            <AlertTriangle size={13} strokeWidth={2.5} />
            <span>TRAP</span>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
            <History size={12} />
            <span>REPLAY</span>
          </div>
        )}
      </motion.div>
    );
  }

  // STANDARD GAME OVER BANNER MODE (Above Board)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[360px] mx-auto flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border backdrop-blur-md shadow-xl select-none"
      style={{
        borderColor: isLoser ? 'rgba(244, 63, 94, 0.4)' : `${winnerConfig.hex}66`,
        boxShadow: isLoser ? '0 0 25px rgba(244, 63, 94, 0.2)' : `0 0 25px ${winnerConfig.glow}`,
      }}
    >
      {/* Winner Icon & Identity */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center p-1 border shadow-md"
          style={{
            borderColor: `${winnerConfig.hex}66`,
            backgroundColor: `${winnerConfig.hex}18`,
            boxShadow: `0 0 10px ${winnerConfig.glow}`,
          }}
        >
          <MarkIcon
            player={(!isSpectator && mySymbol) ? mySymbol : (winner || 'X')}
            size="sm"
            isWinning={isWinner || isSpectator}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-wider uppercase text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            {isWinner ? 'VICTORY' : isLoser ? 'DEFEAT' : `${winner} WINS`}
          </span>
          <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400">
            {isWinner ? 'FLAWLESS GAME' : isLoser ? `WINNER: ${winner}` : 'GAME OVER'}
          </span>
        </div>
      </div>

      {/* Outcome Badge */}
      <div>
        {isWinner && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase border"
            style={{
              color: winnerConfig.hex,
              borderColor: `${winnerConfig.hex}66`,
              backgroundColor: `${winnerConfig.hex}22`,
              boxShadow: `0 0 12px ${winnerConfig.glow}`,
            }}
          >
            <Trophy size={13} strokeWidth={2.5} />
            <span>WIN</span>
          </div>
        )}
        {isLoser && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-400 text-xs font-black tracking-widest uppercase shadow-[0_0_12px_rgba(244,63,94,0.3)]">
            <XCircle size={13} strokeWidth={2.5} />
            <span>LOST</span>
          </div>
        )}
        {isSpectator && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase border"
            style={{
              color: winnerConfig.hex,
              borderColor: `${winnerConfig.hex}66`,
              backgroundColor: `${winnerConfig.hex}22`,
              boxShadow: `0 0 12px ${winnerConfig.glow}`,
            }}
          >
            <Crown size={13} strokeWidth={2.5} />
            <span>FINAL</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export interface GameOverControlsProps {
  winner: MarkSymbol | null;
  outcome?: GameOutcome;
  history: MoveRecord[];
  isReplay: boolean;
  replayStepIndex: number;
  onPlayAgain: () => void;
  onNewMatch?: () => void;
  onHome?: () => void;
  isRematchWaiting?: boolean;
  onOpenReplay: () => void;
  onCloseReplay: () => void;
  onStepChange: (newStepIndex: number) => void;
}

export const GameOverControls: React.FC<GameOverControlsProps> = ({
  winner,
  outcome = 'spectator',
  history,
  isReplay,
  replayStepIndex,
  onPlayAgain,
  onNewMatch,
  onHome,
  isRematchWaiting = false,
  onOpenReplay,
  onCloseReplay,
  onStepChange,
}) => {
  const isLoser = outcome === 'lose';
  const winnerConfig = winner ? (SEAT_COLORS[winner] || SEAT_COLORS.X) : SEAT_COLORS.X;

  // Compute insights for every move
  const insights: MoveInsight[] = useMemo(() => {
    return getMoveInsights(history);
  }, [history]);

  // Sliding window of at most 8 dots
  const totalSteps = history.length;
  const windowStart = Math.max(0, Math.min(replayStepIndex - 4, totalSteps - 8));

  const visibleDots = useMemo(() => {
    if (totalSteps === 0) return [];
    const end = Math.min(totalSteps, windowStart + 8);
    const dots = [];
    for (let i = windowStart; i < end; i++) {
      dots.push({
        index: i,
        hasWarning: Boolean(insights[i]?.hasWarning),
      });
    }
    return dots;
  }, [totalSteps, windowStart, insights]);

  const handleBack = useCallback(() => {
    if (replayStepIndex > 0) {
      const nextIndex = replayStepIndex - 1;
      const nextMove = history[nextIndex];
      track('replay_step', { direction: 'back' });
      soundManager.playPlace(nextMove?.player === 'O' ? 'O' : 'X');
      if (nextMove?.vanished) {
        soundManager.playVanish();
        triggerHaptic('vanish');
      }
      onStepChange(nextIndex);
    }
  }, [replayStepIndex, history, onStepChange]);

  const handleForward = useCallback(() => {
    if (replayStepIndex < totalSteps - 1) {
      const nextIndex = replayStepIndex + 1;
      const nextMove = history[nextIndex];
      track('replay_step', { direction: 'forward' });
      soundManager.playPlace(nextMove?.player === 'O' ? 'O' : 'X');
      if (nextMove?.vanished) {
        soundManager.playVanish();
        triggerHaptic('vanish');
      }
      onStepChange(nextIndex);
    }
  }, [replayStepIndex, totalSteps, history, onStepChange]);

  const handleExit = useCallback(() => {
    track('replay_exited');
    onCloseReplay();
  }, [onCloseReplay]);

  if (!winner) return null;

  // REPLAY CONTROLS BAR (Below Board)
  if (isReplay) {
    return (
      <div className="w-full max-w-[360px] mx-auto flex items-center justify-between gap-1.5 p-2 bg-slate-900/90 border border-white/15 rounded-2xl backdrop-blur-md shadow-xl select-none">
        {/* Back Button */}
        <button
          type="button"
          id="replay-back-btn"
          onClick={handleBack}
          disabled={replayStepIndex === 0}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-white cursor-pointer transition-all active:scale-95 shadow-md"
          aria-label="Previous Move"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>

        {/* Dot row (max 8 visible dots) */}
        <div className="flex items-center justify-center gap-1.5 flex-1 px-1">
          {visibleDots.map((dot) => {
            const isCurrent = dot.index === replayStepIndex;
            return (
              <button
                key={dot.index}
                type="button"
                id={`replay-dot-${dot.index}`}
                onClick={() => {
                  track('replay_step', { direction: dot.index > replayStepIndex ? 'forward' : 'back' });
                  onStepChange(dot.index);
                }}
                className="relative p-1.5 flex items-center justify-center cursor-pointer group"
                aria-label={`Step ${dot.index + 1}`}
              >
                <span
                  className={`rounded-full transition-all duration-200 ${
                    isCurrent
                      ? 'w-3 h-3 bg-cyan-400 shadow-[0_0_10px_#00f0ff]'
                      : 'w-2 h-2 bg-slate-600 group-hover:bg-slate-400'
                  }`}
                />
                {/* Warning icon on dot if step was a trap */}
                {dot.hasWarning && (
                  <span className="absolute -top-1 -right-0.5 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]">
                    <AlertTriangle size={10} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Forward Button */}
        <button
          type="button"
          id="replay-forward-btn"
          onClick={handleForward}
          disabled={replayStepIndex === totalSteps - 1}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-white cursor-pointer transition-all active:scale-95 shadow-md"
          aria-label="Next Move"
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>

        {/* Exit Button: Returns to final position */}
        <button
          type="button"
          id="replay-exit-btn"
          onClick={handleExit}
          className="h-10 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 border border-white/15 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 flex items-center gap-1 text-xs font-black uppercase cursor-pointer transition-all active:scale-95 shadow-md"
          aria-label="Exit Replay"
        >
          <X size={15} strokeWidth={2.5} />
          <span>EXIT</span>
        </button>
      </div>
    );
  }

  // STANDARD GAME OVER ICON BAR (Below Board)
  const primaryBtnClass = isLoser
    ? 'py-3 px-2 rounded-2xl font-black text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer bg-slate-800 border border-white/20 text-white hover:bg-slate-700 hover:border-white/30 shadow-lg flex items-center justify-center gap-1.5'
    : 'py-3 px-2 rounded-2xl font-black text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer text-black shadow-lg flex items-center justify-center gap-1.5';

  const primaryBtnStyle = isLoser
    ? undefined
    : {
        backgroundColor: winnerConfig.hex,
        boxShadow: `0 0 16px ${winnerConfig.glow}`,
      };

  const colCount = onNewMatch ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className={`w-full max-w-[360px] mx-auto grid ${colCount} gap-2 px-1 select-none`}>
      {/* AGAIN / REMATCH */}
      <motion.button
        type="button"
        id="gameover-again-btn"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={onPlayAgain}
        disabled={isRematchWaiting}
        className={primaryBtnClass}
        style={primaryBtnStyle}
        aria-label="Play Again"
      >
        <RotateCcw size={15} strokeWidth={2.5} />
        <span>{isRematchWaiting ? 'WAIT' : 'AGAIN'}</span>
      </motion.button>

      {/* REPLAY (Rewind icon) */}
      <motion.button
        type="button"
        id="gameover-replay-btn"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => {
          track('replay_opened');
          onOpenReplay();
        }}
        className="py-3 px-2 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all"
        aria-label="Replay moves"
      >
        <History size={15} strokeWidth={2.5} />
        <span>REPLAY</span>
      </motion.button>

      {/* NEW MATCH (if present) */}
      {onNewMatch && (
        <motion.button
          type="button"
          id="gameover-newmatch-btn"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onNewMatch}
          className="py-3 px-2 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-cyan-300 hover:text-white hover:border-cyan-400 font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all"
          aria-label="New Match"
        >
          <Compass size={15} strokeWidth={2.5} />
          <span>MATCH</span>
        </motion.button>
      )}

      {/* HOME (if present) */}
      {onHome && (
        <motion.button
          type="button"
          id="gameover-home-btn"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onHome}
          className="py-3 px-2 rounded-2xl bg-slate-900/90 border border-white/15 text-slate-300 hover:text-white hover:border-white/30 font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all"
          aria-label="Home"
        >
          <Home size={15} strokeWidth={2.5} />
          <span>HOME</span>
        </motion.button>
      )}
    </div>
  );
};
