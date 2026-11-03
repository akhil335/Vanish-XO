'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUICK_MESSAGES, QuickMessage } from '@/lib/types';
import { MessageSquare, X } from 'lucide-react';

interface QuickMessagesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (msg: QuickMessage) => void;
  isCooldown?: boolean;
  disabled?: boolean;
}

export const QuickMessages: React.FC<QuickMessagesProps> = ({
  isOpen,
  onClose,
  onSelectMessage,
  isCooldown = false,
  disabled = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop click catcher */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Quick Messages Popover Card */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            role="dialog"
            aria-label="Quick Messages"
            className="fixed sm:absolute bottom-20 sm:bottom-full sm:mb-2.5 left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] sm:w-96 max-w-sm z-50 p-3 rounded-2xl bg-slate-900/95 border border-cyan-500/30 backdrop-blur-xl shadow-2xl shadow-cyan-950/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Quick Messages</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close quick messages"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Grid of Chips */}
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
              {QUICK_MESSAGES.map((msg) => {
                const isDisabled = disabled || isCooldown;
                return (
                  <motion.button
                    key={msg}
                    type="button"
                    disabled={isDisabled}
                    whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                    whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                    onClick={() => {
                      if (!isDisabled) {
                        onSelectMessage(msg);
                        onClose();
                      }
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold text-left border transition-all flex items-center gap-1.5 ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-400'
                        : 'border-white/10 bg-white/5 hover:bg-white/15 hover:border-cyan-400/50 hover:text-cyan-300 text-slate-200 cursor-pointer shadow-sm active:scale-95'
                    }`}
                  >
                    <span className="truncate">{msg}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

