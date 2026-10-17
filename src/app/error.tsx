'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime error:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#06080d] text-white select-none">
      <div className="relative max-w-[280px] w-full bg-[#0a0d16]/90 border border-rose-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.25)]">
          <AlertTriangle size={36} />
        </div>

        <span className="font-black text-xs tracking-widest uppercase text-rose-300/80">ERROR</span>

        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full py-3 rounded-2xl bg-cyan-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:bg-cyan-400 transition-all"
          >
            <RotateCcw size={16} />
            <span>RETRY</span>
          </button>

          <Link
            href="/"
            className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-rose-400 hover:text-rose-300 transition-all"
            aria-label="Home"
          >
            <Home size={16} />
            <span>HOME</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
