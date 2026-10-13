'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { MarkSymbol, SEAT_COLORS } from '@/lib/types';
import { MarkIcon } from './MarkIcon';
import { soundManager, triggerHaptic } from '@/lib/audio';

interface WinModalProps {
  winner: MarkSymbol | null;
  onPlayAgain: () => void;
  isRematchWaiting?: boolean;
}

export const WinModal: React.FC<WinModalProps> = ({ winner, onPlayAgain, isRematchWaiting = false }) => {
  useEffect(() => {
    if (!winner) return;

    soundManager.playWin();
    triggerHaptic('win');

    const config = SEAT_COLORS[winner] || SEAT_COLORS.X;
    const colors = [config.hex, '#ffffff', '#ffd700'];

    // Burst confetti from sides
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [winner]);

  if (!winner) return null;

  const config = SEAT_COLORS[winner] || SEAT_COLORS.X;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none"
      >
        <motion.div
          initial={{ scale: 0.7, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 350 }}
          className="relative max-w-xs w-full bg-[#0a0d16] border rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl"
          style={{
            borderColor: `${config.hex}88`,
            boxShadow: `0 0 35px ${config.glow}`,
          }}
        >
          {/* Ambient Glow Aura */}
          <div
            className="absolute inset-0 rounded-3xl opacity-20 blur-xl pointer-events-none"
            style={{
              backgroundColor: config.hex,
            }}
          />

          {/* Big Winner Mark Icon */}
          <div className="relative z-10 flex items-center justify-center">
            <MarkIcon player={winner} size="hero" isWinning={false} />
          </div>

          {/* Single "Again" button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlayAgain}
            disabled={isRematchWaiting}
            className="relative z-10 w-full py-4 rounded-2xl font-black text-lg tracking-wider uppercase transition-all duration-200 shadow-lg cursor-pointer text-black"
            style={{
              backgroundColor: config.hex,
              boxShadow: `0 0 20px ${config.glow}`,
            }}
          >
            {isRematchWaiting ? 'WAITING...' : 'AGAIN'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
