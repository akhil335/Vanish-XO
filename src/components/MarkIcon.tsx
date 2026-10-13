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
  ageIndex = 2,
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

  // Base colors
  const strokeColor = isWinning ? '#ffd700' : config.hex;

  // Glow filters based on age
  let glowFilter = '';
  let opacity = 1;
  let scale = 1;

  if (isWinning) {
    glowFilter = 'filter-glow-gold';
    opacity = 1;
    scale = 1.08;
  } else if (isDimmed) {
    opacity = 0.15;
    scale = 0.9;
  } else if (isOldestOfThree) {
    // VISUAL TEACHING 1: When a player has 3 marks, their OLDEST mark pulses, is dimmer, slightly smaller
    opacity = 0.45;
    scale = 0.82;
  } else {
    // VISUAL TEACHING 2: All marks show age
    if (ageIndex === 2) {
      // Newest: brightest and fully solid
      opacity = 1.0;
      scale = 1.0;
      glowFilter = `drop-shadow(0 0 10px ${config.hex}) drop-shadow(0 0 16px ${config.glow})`;
    } else if (ageIndex === 1) {
      // Middle: slightly dimmer
      opacity = 0.75;
      scale = 0.93;
      glowFilter = `drop-shadow(0 0 6px ${config.hex}88)`;
    } else {
      // Oldest: faded
      opacity = 0.45;
      scale = 0.86;
      glowFilter = 'drop-shadow(0 0 2px rgba(255,255,255,0.2))';
    }
  }

  const pulseClass = isOldestOfThree && !isWinning ? 'animate-vanish-warning' : '';
  const flickerClass = ageIndex === 0 && !isOldestOfThree && !isWinning ? 'animate-flicker' : '';

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
      className={`relative flex items-center justify-center select-none ${sizeMap[size]} ${pulseClass} ${flickerClass}`}
      style={{
        filter: isWinning ? 'drop-shadow(0 0 16px #ffd700)' : undefined,
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
