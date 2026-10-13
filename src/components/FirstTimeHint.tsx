'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkIcon } from './MarkIcon';
import { ParticleDissolve } from './ParticleDissolve';

interface FirstTimeHintProps {
  onDismiss?: () => void;
}

export const FirstTimeHint: React.FC<FirstTimeHintProps> = ({ onDismiss }) => {
  const [visible, setVisible] = useState(false);
  // Animation phases:
  // 0: showing 3 marks (cell 0 is oldest, cell 4 is middle, cell 6 is newest)
  // 1: tap hand appears over cell 8
  // 2: 4th mark appears at cell 8, cell 0 dissolves
  // 3: reset loop
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('vanish_xo_tutorial_seen');
      if (!seen) {
        const timer = setTimeout(() => {
          setVisible(true);
        }, 50);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage error fallback
    }
  }, []);

  // Looping tutorial timeline
  useEffect(() => {
    if (!visible) return;

    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 1700);
    const t3 = setTimeout(() => setPhase(0), 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible, phase]);

  const dismiss = () => {
    try {
      localStorage.setItem('vanish_xo_tutorial_seen', 'true');
    } catch {
      // safe
    }
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4 cursor-pointer select-none"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-w-xs w-full bg-[#0b0e17] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl shadow-cyan-500/20 flex flex-col items-center gap-5"
        >
          {/* Visual Header Icon */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping delay-100" />
          </div>

          {/* Mini Demo 3x3 Board */}
          <div className="grid grid-cols-3 gap-2 w-52 h-52 p-2 bg-[#06080d] border border-white/10 rounded-2xl relative shadow-inner">
            {/* Cell 0: Oldest mark that will vanish */}
            <div className="relative flex items-center justify-center bg-slate-900/60 rounded-xl border border-white/5 overflow-hidden">
              {phase < 2 ? (
                <MarkIcon player="X" ageIndex={0} isOldestOfThree={true} size="sm" />
              ) : (
                <ParticleDissolve player="X" />
              )}
            </div>

            {/* Cell 1: Empty */}
            <div className="bg-slate-900/30 rounded-xl border border-white/5" />

            {/* Cell 2: Empty */}
            <div className="bg-slate-900/30 rounded-xl border border-white/5" />

            {/* Cell 3: Empty */}
            <div className="bg-slate-900/30 rounded-xl border border-white/5" />

            {/* Cell 4: Middle Mark */}
            <div className="relative flex items-center justify-center bg-slate-900/60 rounded-xl border border-white/5">
              <MarkIcon player="X" ageIndex={1} size="sm" />
            </div>

            {/* Cell 5: Empty */}
            <div className="bg-slate-900/30 rounded-xl border border-white/5" />

            {/* Cell 6: Newest Mark */}
            <div className="relative flex items-center justify-center bg-slate-900/60 rounded-xl border border-white/5">
              <MarkIcon player="X" ageIndex={2} size="sm" />
            </div>

            {/* Cell 7: Empty */}
            <div className="bg-slate-900/30 rounded-xl border border-white/5" />

            {/* Cell 8: Cell being tapped as 4th mark */}
            <div className="relative flex items-center justify-center bg-slate-900/60 rounded-xl border border-cyan-500/30">
              {phase === 2 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  <MarkIcon player="X" ageIndex={2} size="sm" />
                </motion.div>
              )}

              {/* Tapping Indicator */}
              {phase === 1 && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.8, 1.2, 0.9], opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="w-7 h-7 rounded-full bg-cyan-400/40 border-2 border-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-400/60"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-200" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Visual indicator arrows: 4th placed -> 1st dissolves */}
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <svg
              className="w-5 h-5 text-cyan-400 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
            <div className="relative w-5 h-5 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-red-400 animate-ping" />
            </div>
          </div>

          {/* Minimal dismiss prompt (tap anywhere) */}
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5 animate-bounce mt-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span>TAP</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
