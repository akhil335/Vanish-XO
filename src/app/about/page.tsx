import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Info, Trophy, Bot, Cpu, Sparkles } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'About Vanish XO | The Story Behind the Tactical Neon Tic-Tac-Toe',
  description: 'Learn about Vanish XO, why it was created by [Akhil Webdev], and how it revitalizes classic Tic-Tac-Toe with vanishing pieces, intelligent bots, and competitive leaderboards.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center px-3 py-6 sm:py-10 bg-[#06080d] text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Navigation Bar */}
        <header className="w-full flex items-center justify-between">
          <Link
            href="/"
            id="back-home-btn"
            aria-label="Back to Home"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-400 hover:text-white hover:border-cyan-500/40 transition-all cursor-pointer shadow-sm group"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>

          <div className="flex flex-col items-center">
            <span className="text-lg sm:text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
              VANISH XO
            </span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/90 flex items-center gap-1">
              <Info size={11} /> ABOUT THE PROJECT
            </span>
          </div>

          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer"
          >
            PLAY
          </Link>
        </header>

        {/* About Content Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">Vanish XO</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              <strong>Vanish XO</strong> is a modern tactical reinvention of one of history&apos;s oldest pen-and-paper games. Developed by <strong>[Akhil Webdev]</strong>, the game was conceived out of a fundamental frustration: traditional Tic-Tac-Toe is mathematically broken because two experienced players will inevitably force a draw every single time.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-cyan-300 tracking-wide flex items-center gap-2">
              <Sparkles size={18} /> Why Vanish XO Was Created
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              We set out to create a brain-teasing game that retains the instant accessibility of Tic-Tac-Toe while removing its flaws. By enforcing an unforgiving 3-mark limit — where placing a fourth mark causes your oldest piece to evaporate — we eliminated stalemates forever. The board transforms from a static grid into an active cycle of shifting threats, tactical traps, and temporal memory challenges.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-pink-300 tracking-wide flex items-center gap-2">
              <Cpu size={18} /> What Makes It Different
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Unlike normal Tic-Tac-Toe where games end when all 9 squares are filled, Vanish XO games feature a maximum of 6 marks simultaneously on the board. This constant movement guarantees that no match can ever end in a draw. Players must look several moves ahead, predicting not only where pieces will land, but which foundational pieces will disappear.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-amber-300 tracking-wide flex items-center gap-2">
              <Trophy size={18} /> What Players Can Expect
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                  <Bot size={15} className="text-cyan-400" /> Multi-Tier Bot AI
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Sharpen your skills offline against our custom AI bots, tuned across Easy, Medium, and minimax-driven Hard difficulties.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
                <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                  <Trophy size={15} className="text-amber-400" /> Global Leaderboard
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Track your competitive ratings with our Elo ranking engine and see where you stand among top players worldwide.
                </p>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed pt-2">
              Whether you are playing solo against the computer or challenging a friend in private online rooms, Vanish XO delivers fast, thrilling, and definitive matches designed for modern browsers and mobile devices.
            </p>
          </section>
        </div>

        {/* Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
