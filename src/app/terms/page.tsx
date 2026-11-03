import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, FileText, CheckCircle2, AlertOctagon, RotateCcw, ServerOff, ShieldCheck } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Terms of Use | Vanish XO',
  description: 'Review the Terms of Use for Vanish XO, covering fair play guidelines, leaderboard conduct, availability disclaimers, and ranking resets.',
};

export default function TermsPage() {
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
              <FileText size={11} /> TERMS OF USE
            </span>
          </div>

          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer"
          >
            PLAY
          </Link>
        </header>

        {/* Content Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col gap-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-mono uppercase tracking-wider">
                Platform Rules
              </span>
              <span className="text-slate-500 text-xs">Last updated: October 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
              Terms of Use
            </h1>
            <p className="text-slate-400">
              Welcome to Vanish XO. By accessing or playing our game on this website, you agree to comply with and be bound by the following terms and guidelines.
            </p>
          </div>

          {/* Term 1: Fair Play */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <ShieldCheck size={16} /> 1. Fair Play &amp; Community Conduct
            </h2>
            <p>
              Vanish XO is designed to provide a fun, tactical competitive environment. All players agree to participate in good faith. Offensive display names, impersonation of other community members, harassment in room chats, and any abusive behavior are strictly forbidden.
            </p>
          </section>

          {/* Term 2: Leaderboard Integrity */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-pink-300 flex items-center gap-2">
              <AlertOctagon size={16} /> 2. No Cheating or Leaderboard Abuse
            </h2>
            <p>
              The global leaderboard and Elo rating calculation represent genuine competitive skill. You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
              <li>Use unauthorized third-party automation, bots, or scripts to manipulate live or rated games.</li>
              <li>Engage in win-trading, match manipulation, or artificial rating inflation.</li>
              <li>Exploit client-side or server-side software glitches to gain an unfair advantage or falsify records.</li>
            </ul>
            <p className="text-slate-400 text-xs">
              We reserve the absolute right to remove, flag, or disqualify any player account or score identified as fraudulent or violating fair play.
            </p>
          </section>

          {/* Term 3: Rankings Resets */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <RotateCcw size={16} /> 3. Leaderboard Resets &amp; Competitive Seasons
            </h2>
            <p>
              To maintain healthy competition, balance ratings, resolve data discrepancies, or mark the beginning of new competitive seasons, <strong>rankings, ratings, and leaderboard entries may be adjusted or completely reset at our sole discretion</strong>. No user is entitled to permanent retention of rank or historical statistics.
            </p>
          </section>

          {/* Term 4: Service Availability */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <ServerOff size={16} /> 4. No Guarantees of Availability (&quot;As Is&quot;)
            </h2>
            <p>
              Vanish XO is provided free of charge on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. We do not guarantee uninterrupted uptime, bug-free gameplay, or zero latency during multiplayer connections. We reserve the right to alter features, perform scheduled maintenance, or discontinue game modes without prior notice.
            </p>
          </section>

          {/* Term 5: Inquiries */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <CheckCircle2 size={16} /> 5. Questions &amp; Support
            </h2>
            <p>
              For inquiries regarding these terms, please contact us at{' '}
              <a
                href="mailto:[akhilwebsite.dev@gmail.com]"
                className="text-cyan-300 hover:text-cyan-200 underline font-mono"
              >
                [akhilwebsite.dev@gmail.com]
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
