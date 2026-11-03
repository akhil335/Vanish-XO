'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LiveReaction, EmojiReaction, QuickMessage } from '@/lib/types';
import { ReactionBubble } from './ReactionBubble';
import { EmojiReactions } from './EmojiReactions';
import { QuickMessages } from './QuickMessages';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { MessageSquare } from 'lucide-react';

interface MatchChatProps {
  reactions: LiveReaction[];
  onSendReaction: (reaction: { emoji?: string; quickMessage?: string }) => void;
  onDismissReaction?: (id: string) => void;
  disabled?: boolean;
  className?: string;
  showOverlay?: boolean;
}

const COOLDOWN_MS = 1400;

export const MatchChat: React.FC<MatchChatProps> = ({
  reactions,
  onSendReaction,
  onDismissReaction,
  disabled = false,
  className = '',
  showOverlay = true,
}) => {
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownProgress, setCooldownProgress] = useState(0);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const triggerCooldown = useCallback(() => {
    setIsCooldown(true);
    setCooldownProgress(100);

    const startTime = Date.now();

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / COOLDOWN_MS) * 100);
      setCooldownProgress(remaining);
      if (remaining <= 0 && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }, 40);

    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setIsCooldown(false);
      setCooldownProgress(0);
    }, COOLDOWN_MS);
  }, []);

  const handleSelectEmoji = (emoji: EmojiReaction) => {
    if (disabled || isCooldown) return;
    triggerCooldown();
    soundManager.playReaction();
    triggerHaptic('reaction');
    onSendReaction({ emoji });
  };

  const handleSelectQuickMessage = (quickMessage: QuickMessage) => {
    if (disabled || isCooldown) return;
    triggerCooldown();
    soundManager.playReaction();
    triggerHaptic('reaction');
    onSendReaction({ quickMessage });
  };

  return (
    <div className={`relative flex flex-col items-center w-full max-w-md mx-auto ${className}`}>
      {/* Floating Reactions Overlay (pointer-events-none so board is never blocked) */}
      {showOverlay && (
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center p-4 overflow-hidden"
        >
          <div className="relative w-full max-w-sm h-64 flex flex-col items-center justify-center gap-3">
            <AnimatePresence>
              {reactions.slice(-4).map((r) => (
                <ReactionBubble
                  key={r.id}
                  reaction={r}
                  onDismiss={onDismissReaction}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Interactive Reaction & Chat Bar */}
      <div className="relative flex items-center justify-center gap-1.5 w-full px-2">
        {/* Emoji Reactions Toolbar */}
        <div className="flex-1 min-w-0">
          <EmojiReactions
            onSelectEmoji={handleSelectEmoji}
            isCooldown={isCooldown}
            cooldownProgress={cooldownProgress}
            disabled={disabled}
          />
        </div>

        {/* Quick Message Toggle Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsQuickOpen((prev) => !prev)}
            disabled={disabled || isCooldown}
            aria-label="Open quick messages"
            className={`flex items-center justify-center gap-1.5 h-10 px-3 rounded-2xl border text-xs font-bold transition-all shadow-md select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isQuickOpen
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-cyan-500/30'
                : isCooldown || disabled
                ? 'opacity-40 cursor-not-allowed border-white/10 bg-slate-900/60 text-slate-400'
                : 'bg-slate-900/80 border-white/10 hover:border-cyan-400/40 text-slate-200 hover:text-white cursor-pointer active:scale-95'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline sm:inline">Chat</span>
          </button>

          {/* Quick Messages Popover */}
          <QuickMessages
            isOpen={isQuickOpen}
            onClose={() => setIsQuickOpen(false)}
            onSelectMessage={handleSelectQuickMessage}
            isCooldown={isCooldown}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};
