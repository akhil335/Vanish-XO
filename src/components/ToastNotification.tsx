'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserMinus, Users, Crown } from 'lucide-react';
import { SEAT_COLORS, MARK_SYMBOLS } from '@/lib/types';

export interface ToastItem {
  id: string;
  type: 'player_joined' | 'player_left' | 'seats_changed' | 'host_changed';
  seatIndex?: number;
  seatsCount?: 2 | 3 | 4;
  isBot?: boolean;
  newHostPlayerId?: string;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          if (toast.type === 'host_changed') {
            const seatIdx = toast.seatIndex ?? 0;
            const symbol = MARK_SYMBOLS[seatIdx] || 'X';
            const config = SEAT_COLORS[symbol] || SEAT_COLORS.X;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/50 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.3)] text-xs font-bold"
              >
                <Crown size={14} className="text-amber-400 fill-amber-400" />
                <span style={{ color: config.hex }}>{symbol}</span>
                <span className="text-amber-300">NEW HOST</span>
              </motion.div>
            );
          }

          if (toast.type === 'seats_changed') {
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.3)] text-xs font-bold"
              >
                <Users size={14} className="text-cyan-400" />
                <span className="font-mono text-cyan-400">{toast.seatsCount}P</span>
              </motion.div>
            );
          }

          const seatIdx = toast.seatIndex ?? 0;
          const symbol = MARK_SYMBOLS[seatIdx] || 'X';
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
