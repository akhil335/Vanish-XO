'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Bot,
  Flame,
  Zap,
  Users,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { BADGE_DEFINITIONS, BadgeDefinition } from '@/lib/progress';

export interface BadgeToastItem {
  id: string; // unique toast id
  badgeId: string;
  customTitle?: string;
  customName?: string;
  customIcon?: string;
}

interface BadgeToastProps {
  toasts: BadgeToastItem[];
  onDismiss: (id: string) => void;
}

export function renderBadgeIcon(iconName: string, size: number = 18, className?: string) {
  switch (iconName) {
    case 'trophy':
      return <Trophy size={size} className={className || 'text-amber-400'} />;
    case 'bot-easy':
      return <Bot size={size} className={className || 'text-emerald-400'} />;
    case 'bot-med':
      return <Bot size={size} className={className || 'text-cyan-400'} />;
    case 'bot-hard':
      return <Bot size={size} className={className || 'text-purple-400'} />;
    case 'flame-3':
      return <Flame size={size} className={className || 'text-orange-400'} />;
    case 'flame-5':
      return <Flame size={size} className={className || 'text-rose-500'} />;
    case 'zap':
      return <Zap size={size} className={className || 'text-yellow-300'} />;
    case 'users-3':
      return <Users size={size} className={className || 'text-yellow-400'} />;
    case 'users-4':
      return <Users size={size} className={className || 'text-purple-400'} />;
    case 'shield-check':
      return <ShieldCheck size={size} className={className || 'text-cyan-300'} />;
    default:
      return <Award size={size} className={className || 'text-white'} />;
  }
}

export const BadgeToast: React.FC<BadgeToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none select-none items-center max-w-[90vw]">
      <AnimatePresence>
        {toasts.map((toast) => {
          const badge: BadgeDefinition | undefined = BADGE_DEFINITIONS.find((b) => b.id === toast.badgeId);
          if (!badge && !toast.customName) return null;

          const title = toast.customTitle || 'UNLOCKED';
          const name = toast.customName || badge?.name || 'Achievement';
          const icon = toast.customIcon || badge?.icon || 'zap';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: [0.8, 1.08, 1],
                transition: { duration: 0.4, ease: 'easeOut' },
              }}
              exit={{ opacity: 0, y: -10, scale: 0.9, transition: { duration: 0.2 } }}
              onAnimationComplete={() => {
                const timer = setTimeout(() => {
                  onDismiss(toast.id);
                }, 3800);
                return () => clearTimeout(timer);
              }}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/95 border border-cyan-400/50 backdrop-blur-xl shadow-[0_0_25px_rgba(0,240,255,0.35)] pointer-events-auto cursor-pointer"
              onClick={() => onDismiss(toast.id)}
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                {renderBadgeIcon(icon, 18)}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
                  {title}
                </span>
                <span className="text-xs font-bold text-white tracking-wide">
                  {name}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
