'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface RankDeltaIndicatorProps {
  delta: number | null;
  tierColor?: string;
}

export const RankDeltaIndicator: React.FC<RankDeltaIndicatorProps> = ({ delta, tierColor = '#00f0ff' }) => {
  if (delta === null) return null;

  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isZero = delta === 0;

  const text = isPositive ? `+${delta}` : isNegative ? `${delta}` : '0';
  const colorClass = isPositive
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
    : isNegative
    ? 'text-rose-400 border-rose-500/40 bg-rose-950/60 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
    : 'text-slate-400 border-slate-700 bg-slate-900/60 shadow-none';

  return (
    <div className="w-full flex justify-center items-center py-1 select-none pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={`rank-delta-${delta}`}
          initial={{ opacity: 0, y: 8, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md text-xs font-black tracking-wider uppercase ${colorClass}`}
        >
          <Bot size={13} style={{ color: tierColor }} />
          <span>RANK</span>
          <span className="font-mono font-extrabold">{text}</span>
          {isPositive && (
            <motion.span
              animate={{ y: [-1, -3, -1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <ArrowUpRight size={13} className="text-emerald-400" />
            </motion.span>
          )}
          {isNegative && (
            <motion.span
              animate={{ y: [1, 3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <ArrowDownRight size={13} className="text-rose-400" />
            </motion.span>
          )}
          {isZero && <Minus size={12} className="text-slate-400" />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
