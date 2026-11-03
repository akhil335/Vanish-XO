import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Gamepad2, Sparkles, HelpCircle, Lightbulb, ShieldAlert, Award } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'How to Play Vanish XO | Rules, Strategies & FAQ',
  description: 'Master the rules of Vanish XO. Learn the 3-mark vanishing limit, game-winning strategies, and why draws are impossible in this tactical neon Tic-Tac-Toe variant.',
};

export default function HowToPlayPage() {
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
              <Gamepad2 size={11} /> GAMEPLAY GUIDE
            </span>
          </div>

          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer"
          >
            PLAY
          </Link>
        </header>

        {/* Hero Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col gap-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">
              How to Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">Vanish XO</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Vanish XO takes the universally familiar 3&times;3 grid of classic Tic-Tac-Toe and transforms it into a dynamic, memory-driven tactical battle. By enforcing a strict rule that marks fade and disappear over time, every game forces continuous spatial awareness, adaptive planning, and rapid tactical decision-making.
            </p>
          </div>

          {/* Core Goal */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <Sparkles size={18} />
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                The Core Objective
              </h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Just like standard Tic-Tac-Toe, your primary goal is to align three of your marks in an unbroken straight line — horizontally, vertically, or diagonally. Player 1 commands the cyan <strong>X</strong> marks, while Player 2 (or the AI Bot) commands the neon pink <strong>O</strong> marks.
            </p>
          </section>

          {/* The Vanishing Rule */}
          <section className="space-y-4 p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
            <div className="flex items-center gap-2 text-cyan-300">
              <ShieldAlert size={18} />
              <h2 className="text-lg font-bold text-cyan-200 tracking-wide">
                The 3-Mark Limit &amp; Vanishing Twist
              </h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              In traditional Tic-Tac-Toe, pieces stay permanently where you place them until all 9 spaces are occupied. In Vanish XO, <strong>each player is permitted a maximum of three active marks on the board at any given time</strong>.
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              The moment you place your <strong>4th mark</strong>, your <strong>1st (oldest) mark vanishes instantly into thin air</strong>. Crucially, the oldest mark disappears from the grid <em>before</em> the victory condition is evaluated for that turn. That means you cannot claim a 3-in-a-row victory using a mark that is scheduled to dissolve on that exact move.
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              To assist your memory during rapid matches, Vanish XO features illuminated visual age indicators. Your active marks transition from a crisp, vivid glow to a dimming, pulsing warning as they approach the expiration threshold.
            </p>
          </section>

          {/* Why There Are No Draws */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-pink-300 tracking-wide">
              Why Draws Are Impossible
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Standard Tic-Tac-Toe almost always concludes in an uninspiring stalemate once both players understand basic defensive moves. In Vanish XO, because neither player can sustain more than 3 active marks, there can never be more than 6 total marks on the 9-cell board at any instant.
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Because the board never becomes crowded or locked, a tie or cat&apos;s game is mathematically impossible. Positions constantly shift and open up until one player successfully outmaneuvers their opponent and strikes a decisive winning blow.
            </p>
          </section>

          {/* Tactical Strategies */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Lightbulb size={18} />
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                Tactical Strategies for Victory
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <h3 className="font-bold text-cyan-300">1. Track Expiration Cycles</h3>
                <p className="text-slate-400 leading-relaxed">
                  Keep mental track of your opponent&apos;s oldest mark. If their key blocking piece is about to evaporate on their next move, you can prepare an unavoidable attack path.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <h3 className="font-bold text-pink-300">2. Build Double Threats</h3>
                <p className="text-slate-400 leading-relaxed">
                  Position your second and third marks to threaten two distinct 3-in-a-row lines simultaneously. Your opponent can only block one, securing your win on the subsequent turn.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <h3 className="font-bold text-amber-300">3. Bait Urgent Defensive Blocks</h3>
                <p className="text-slate-400 leading-relaxed">
                  Force your adversary to respond to an immediate threat. When they place their countermark, they might unintentionally vanish their most critical strategic anchor elsewhere.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <h3 className="font-bold text-emerald-300">4. Treat the Center Dynamically</h3>
                <p className="text-slate-400 leading-relaxed">
                  Securing the center cell on Turn 1 gives an early advantage, but remember that mark will dissolve on Turn 4. Be prepared with a fallback structure before it vanishes.
                </p>
              </div>
            </div>
          </section>

          {/* Frequently Asked Questions */}
          <section className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-cyan-400">
              <HelpCircle size={18} />
              <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                Frequently Asked Questions (FAQ)
              </h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <h3 className="font-bold text-sm text-cyan-200">
                  Can I win on the exact same turn my oldest piece vanishes?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  No. The expiration of your oldest mark executes immediately before the system tests for a winning line. If your 3-in-a-row depended on the piece that just disappeared, it will not count as a victory.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <h3 className="font-bold text-sm text-cyan-200">
                  How can I tell which piece is going to vanish next?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  The in-game board features subtle visual pulsing indicators and dimmed glows on expiring marks, plus age dots located on the top player status cards.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <h3 className="font-bold text-sm text-cyan-200">
                  How long does an average match take?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Most games resolve within 8 to 16 fast-paced turns, typically lasting between 30 and 90 seconds. It is designed to be rapid, intense, and replayable.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <h3 className="font-bold text-sm text-cyan-200">
                  Does the bot play with the same rules and vanishing mechanics?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Yes, absolutely. The AI operates under the identical 3-mark limit. On higher difficulty tiers, the bot simulates several vanishing turns into the future to trap human players.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <h3 className="font-bold text-sm text-cyan-200">
                  Can I play Vanish XO with a friend?
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Yes! You can use Pass &amp; Play on a shared device, or tap the Invite button to generate a room code and compete live over the internet.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
