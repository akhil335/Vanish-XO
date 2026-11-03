'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { LiveReaction, SEAT_COLORS, MarkSymbol } from '@/lib/types';

interface ReactionBubbleProps {
  reaction: LiveReaction;
  onDismiss?: (id: string) => void;
}

export const ReactionBubble: React.FC<ReactionBubbleProps> = ({ reaction, onDismiss }) => {
  const { id, symbol, playerName, emoji, quickMessage } = reaction;
  const onDismissRef = React.useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current?.(id);
    }, 2800);
    return () => clearTimeout(timer);
  }, [id]);

  const colorConfig = SEAT_COLORS[symbol as MarkSymbol] || {
    hex: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.4)',
    textGlow: '0 0 10px rgba(0, 240, 255, 0.8)',
  };

  const isEmojiOnly = Boolean(emoji && !quickMessage);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.4, y: 20 }}
      animate={{
        opacity: [0, 1, 1, 0.9, 0],
        scale: [0.5, 1.1, 1, 1, 0.85],
        y: [20, -10, -25, -45, -70],
      }}
      transition={{
        duration: 2.8,
        times: [0, 0.15, 0.4, 0.8, 1],
        ease: 'easeOut',
      }}
      className="pointer-events-none flex flex-col items-center select-none"
      style={{
        filter: `drop-shadow(0 4px 12px ${colorConfig.glow})`,
      }}
    >
      {isEmojiOnly ? (
        <div className="flex flex-col items-center gap-1">
          <motion.span
            animate={{
              rotate: [0, -8, 8, -4, 0],
              scale: [1, 1.25, 1],
            }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="text-4xl sm:text-5xl drop-shadow-md"
          >
            {emoji}
          </motion.span>
          <div
            className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 border backdrop-blur-md bg-slate-950/80"
            style={{
              borderColor: `${colorConfig.hex}55`,
              color: colorConfig.hex,
            }}
          >
            <span className="font-mono">{symbol}</span>
            <span className="truncate max-w-[80px]">{playerName}</span>
          </div>
        </div>
      ) : (
        <div
          className="relative max-w-[220px] sm:max-w-[280px] px-3.5 py-2 rounded-2xl border backdrop-blur-md bg-slate-950/90 shadow-xl flex flex-col gap-0.5"
          style={{
            borderColor: `${colorConfig.hex}77`,
            boxShadow: `0 0 16px ${colorConfig.glow}, inset 0 0 8px ${colorConfig.glow}`,
          }}
        >
          {/* Header with symbol and sender */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center font-mono text-[10px] text-slate-950"
              style={{ backgroundColor: colorConfig.hex }}
            >
              {symbol}
            </span>
            <span className="truncate" style={{ color: colorConfig.hex }}>
              {playerName}
            </span>
          </div>

          {/* Quick Message Content */}
          <div className="text-white text-xs sm:text-sm font-semibold tracking-wide drop-shadow break-words flex items-center gap-1.5">
            <span>{quickMessage}</span>
          </div>

          {/* Small Speech Bubble Tail */}
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b bg-slate-950"
            style={{ borderColor: `${colorConfig.hex}77` }}
          />
        </div>
      )}
    </motion.div>
  );
};

