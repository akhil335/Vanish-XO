'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { EMOJI_REACTIONS, EmojiReaction } from '@/lib/types';

interface EmojiReactionsProps {
  onSelectEmoji: (emoji: EmojiReaction) => void;
  isCooldown?: boolean;
  cooldownProgress?: number; // 0 to 100
  disabled?: boolean;
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  onSelectEmoji,
  isCooldown = false,
  cooldownProgress = 0,
  disabled = false,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Emoji reactions"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      className="relative flex items-center justify-between gap-0.5 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-md shadow-lg overflow-x-auto no-scrollbar max-w-full"
    >
      {/* Cooldown progress overlay indicator */}
      {isCooldown && cooldownProgress > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
        >
          <div
            className="h-full bg-cyan-500/15 transition-all duration-75 ease-linear"
            style={{ width: `${cooldownProgress}%` }}
          />
        </div>
      )}

      {EMOJI_REACTIONS.map((emoji) => {
        const isDisabled = disabled || isCooldown;
        return (
          <motion.button
            key={emoji}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelectEmoji(emoji)}
            whileHover={!isDisabled ? { scale: 1.25, y: -2 } : undefined}
            whileTap={!isDisabled ? { scale: 0.9 } : undefined}
            aria-label={`React with ${emoji}`}
            className={`relative flex items-center justify-center shrink-0 w-6.5 h-6.5 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-xl text-sm xs:text-base sm:text-lg transition-opacity duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isDisabled
                ? 'opacity-40 cursor-not-allowed filter grayscale-[0.2]'
                : 'hover:bg-white/10 cursor-pointer active:scale-95'
            }`}
          >
            <span className="leading-none">{emoji}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

