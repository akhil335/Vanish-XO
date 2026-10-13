'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserMinus } from 'lucide-react';
import { SEAT_COLORS, MARK_SYMBOLS } from '@/lib/types';

export interface ToastItem {
  id: string;
  type: 'player_joined' | 'player_left';
  seatIndex: number;
  isBot?: boolean;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const symbol = MARK_SYMBOLS[toast.seatIndex] || 'X';
          const config = SEAT_COLORS[symbol] || SEAT_COLORS.X;
          const isJoin = toast.type === 'player_joined';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border backdrop-blur-md shadow-xl text-xs font-bold"
              style={{
                borderColor: `${config.hex}66`,
                boxShadow: `0 0 15px ${config.glow}`,
              }}
            >
              {isJoin ? (
                <UserPlus size={14} style={{ color: config.hex }} />
              ) : (
                <UserMinus size={14} className="text-red-400" />
              )}
              <span style={{ color: config.hex }}>
                {symbol}
              </span>
              <span className="text-slate-300">
                {isJoin ? (toast.isBot ? 'BOT' : 'IN') : 'OUT'}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
