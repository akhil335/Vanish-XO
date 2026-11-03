'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Layers, Wind, Zap, Play, ChevronRight, X } from 'lucide-react';

export const TUTORIAL_STORAGE_KEY = 'vanishxo_tutorial_done';
export const LEGACY_TUTORIAL_KEY = 'vanish_xo_tutorial_seen';

export function isTutorialCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return (
      localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true' ||
      localStorage.getItem(LEGACY_TUTORIAL_KEY) === 'true'
    );
  } catch {
    return true;
  }
}

export function markTutorialCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    localStorage.setItem(LEGACY_TUTORIAL_KEY, 'true');
  } catch {
    // Storage access fallback
  }
}

export interface FirstTimeHintProps {
  isOpen: boolean;
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

const STEPS_DATA = [
  {
    badge: 'Step 1 of 5',
    text: 'Welcome to Vanish XO. Get 3 in a row to win.',
    icon: Sparkles,
  },
  {
    badge: 'Step 2 of 5',
    text: 'You only get 3 marks. Place a 4th and your oldest one vanishes.',
    icon: Layers,
    renderVisual: () => (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs">
        <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-black text-[11px] opacity-40 line-through">
          1
        </span>
        <span className="text-slate-500 text-[10px]">→</span>
        <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-black text-[11px]">
          2
        </span>
        <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-black text-[11px]">
          3
        </span>
        <span className="text-slate-500 text-[10px]">→</span>
        <span className="w-5 h-5 rounded-md bg-pink-500/30 border border-pink-400/60 text-pink-300 flex items-center justify-center font-black text-[11px] animate-pulse">
          4
        </span>
      </div>
    ),
  },
  {
    badge: 'Step 3 of 5',
    text: 'Watch the fading mark. It shows which one will disappear next.',
    icon: Wind,
    renderVisual: () => (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-xs">
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-cyan-400 flex items-center justify-center relative bg-cyan-950/30">
          <span className="font-black text-cyan-300 text-xs">X</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-cyan-300">
          <Wind size={12} className="text-cyan-400 animate-pulse" />
          <span>Fades next</span>
        </div>
      </div>
    ),
  },
  {
    badge: 'Step 4 of 5',
    text: 'There are no draws. Plan your moves around what vanishes.',
    icon: Zap,
  },
  {
    badge: 'Step 5 of 5',
    text: "Now it's your turn. Tap a cell to start!",
    icon: Play,
  },
];

export const FirstTimeHint: React.FC<FirstTimeHintProps> = ({
  isOpen,
  step,
  onNext,
  onSkip,
}) => {
  if (!isOpen) return null;

  const currentStepData = STEPS_DATA[Math.min(Math.max(step, 0), STEPS_DATA.length - 1)];
  const isLastStep = step >= STEPS_DATA.length - 1;
  const StepIcon = currentStepData.icon;

  return (
    <>
      {/* Semi-transparent backdrop on steps 1-4; removed on step 5 so play is never blocked */}
      {!isLastStep && (
        <motion.div
          key="tutorial-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1.5px] transition-opacity"
        />
      )}

      {/* Floating Coach-Mark Card */}
      <div className="fixed inset-x-3 bottom-4 sm:bottom-6 z-50 flex justify-center pointer-events-none select-none">
        <motion.div
          key={`tutorial-step-${step}`}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-sm sm:max-w-md bg-[#0b0f19]/95 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_30px_rgba(0,240,255,0.25)] backdrop-blur-md pointer-events-auto flex flex-col gap-3"
        >
          {/* Header: Step Badge + Step Dots + Quick Dismiss */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {currentStepData.badge}
              </span>
              <div className="flex items-center gap-1">
                {STEPS_DATA.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-4 bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.8)]'
                        : i < step
                        ? 'w-1.5 bg-cyan-600/70'
                        : 'w-1.5 bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              id="tutorial-skip-x-btn"
              aria-label="Skip Tutorial"
              onClick={onSkip}
              className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.3)] mt-0.5">
              <StepIcon size={16} />
            </div>

            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <p className="text-sm sm:text-base font-semibold text-slate-100 leading-snug">
                {currentStepData.text}
              </p>

              {/* Step Visual Hint if present */}
              {currentStepData.renderVisual && (
                <div className="pt-0.5">
                  {currentStepData.renderVisual()}
                </div>
              )}
            </div>
          </div>

          {/* Footer Controls: Skip button and Next / Start Playing button */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <button
              type="button"
              id="tutorial-skip-btn"
              onClick={onSkip}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Skip
            </button>

            <button
              type="button"
              id={isLastStep ? 'tutorial-start-btn' : 'tutorial-next-btn'}
              onClick={onNext}
              className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm ${
                isLastStep
                  ? 'bg-gradient-to-r from-cyan-400 to-pink-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:brightness-110'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
              }`}
            >
              <span>{isLastStep ? 'Start Playing' : 'Next'}</span>
              {!isLastStep && <ChevronRight size={14} />}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};
