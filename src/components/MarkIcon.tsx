'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MarkSymbol, SEAT_COLORS } from '@/lib/types';

interface MarkIconProps {
  player: MarkSymbol;
  ageIndex?: 0 | 1 | 2; // 0 = oldest, 1 = middle, 2 = newest
  isOldestOfThree?: boolean; // When player has 3 marks, oldest is ready to vanish
  isWinning?: boolean;
  isDimmed?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const MarkIcon: React.FC<MarkIconProps> = ({
  player,
  isOldestOfThree = false,
  isWinning = false,
  isDimmed = false,
  size = 'md',
}) => {
  const config = SEAT_COLORS[player] || SEAT_COLORS.X;

  // Sizing
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-14 h-14 sm:w-18 sm:h-18',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
    hero: 'w-28 h-28 sm:w-36 sm:h-36',
  };

  // Base colors - always preserve the player symbol's authentic neon color
  const strokeColor = config.hex;

  // Glow filters based on age
  let glowFilter = '';
  let opacity = 1;
  let scale = 1;

  if (isWinning) {
    glowFilter = `drop-shadow(0 0 12px ${config.hex}) drop-shadow(0 0 24px ${config.glow})`;
    opacity = 1;
    scale = 1.08;
  } else if (isDimmed) {
    opacity = 0.28;
    scale = 0.92;
  } else if (isOldestOfThree) {
    // Only the oldest of three gets the warning - clear pulse, high contrast for bright light visibility
    opacity = 0.95;
    scale = 0.96;
    glowFilter = `drop-shadow(0 0 10px ${config.hex}) drop-shadow(0 0 18px ${config.glow})`;
  } else {
    // Marks stay at full brightness (1.0) until the owner has 3 marks, and the other 2 stay at full strength
    opacity = 1.0;
    scale = 1.0;
    glowFilter = `drop-shadow(0 0 10px ${config.hex}) drop-shadow(0 0 16px ${config.glow})`;
  }

  const pulseClass = isOldestOfThree && !isWinning ? 'animate-pulse' : '';

  return (
    <motion.div
      initial={{ scale: 0.2, opacity: 0, rotate: player === 'X' ? -20 : 20 }}
      animate={{
        scale,
        opacity,
        rotate: 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 450,
        damping: 24,
      }}
      className={`relative flex items-center justify-center select-none ${sizeMap[size]} ${pulseClass}`}
      style={{
        filter: isWinning ? `drop-shadow(0 0 16px ${config.glow})` : undefined,
      }}
    >
      {player === 'X' && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: glowFilter }}
          fill="none"
          stroke={strokeColor}
          strokeWidth="14"
          strokeLinecap="round"
        >
          <motion.line
            x1="22"
            y1="22"
            x2="78"
            y2="78"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.line
            x1="78"
            y1="22"
            x2="22"
            y2="78"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
          />
        </svg>
      )}

      {player === 'O' && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: glowFilter }}
          fill="none"
          stroke={strokeColor}
          strokeWidth="14"
          strokeLinecap="round"
        >
          <motion.circle
            cx="50"
            cy="50"
            r="32"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      )}

      {player === '▲' && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: glowFilter }}
          fill="none"
          stroke={strokeColor}
          strokeWidth="13"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <motion.polygon
            points="50,20 84,80 16,80"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      )}

      {player === '■' && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: glowFilter }}
          fill="none"
          stroke={strokeColor}
          strokeWidth="13"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <motion.rect
            x="24"
            y="24"
            width="52"
            height="52"
            rx="10"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      )}

      {/* Vanish warning indicator badge: subtle dotted ring */}
      {isOldestOfThree && !isWinning && (
        <span
          className="absolute inset-0 rounded-full border-2 border-dashed border-red-500/50 animate-ping opacity-30 pointer-events-none"
          style={{ animationDuration: '1.2s' }}
        />
      )}
    </motion.div>
  );
};
