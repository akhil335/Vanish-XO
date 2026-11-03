import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Shield, Lock, Eye, Cookie, Mail, UserCheck, ExternalLink } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy | Vanish XO',
  description: 'Learn how Vanish XO handles player data, local storage, cookies, analytics, and advertising disclosure including Google AdSense compliance.',
};

export default function PrivacyPolicyPage() {
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
              <Shield size={11} /> PRIVACY POLICY
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
                Legal &amp; Transparency
              </span>
              <span className="text-slate-500 text-xs">Last updated: October 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
              Privacy Policy
            </h1>
            <p className="text-slate-400">
              Your privacy is fundamentally important to us at Vanish XO. This Privacy Policy outlines what information we collect, how it is used, how cookies and local storage function, and our advertising practices in compliance with Google AdSense guidelines.
            </p>
          </div>

          {/* Section 1: Information Collected */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <Lock size={16} /> 1. Information We Collect
            </h2>
            <p>
              Vanish XO does not require users to create traditional accounts with sensitive personal data to play the core game. The information collected is minimal, non-sensitive, and designed solely to maintain game state and competitive features:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
              <li>
                <strong>Anonymous User Identifier:</strong> A randomly generated string (e.g. <code className="text-cyan-400 font-mono">p_xxxxxxxx</code>) stored locally in your browser to distinguish players and manage multiplayer rooms.
              </li>
              <li>
                <strong>Display Name:</strong> A chosen nickname or randomly assigned guest name (such as <code className="text-cyan-400 font-mono">NeonFox42</code>) displayed during matches and on the global leaderboard.
              </li>
              <li>
                <strong>Game Results &amp; Leaderboard Data:</strong> Records of game outcomes (wins, losses, draws, moves played, and calculated Elo ratings) submitted to track global standings.
              </li>
            </ul>
            <p className="mt-2 text-slate-300">
              <strong>Google Sign-In:</strong> We offer optional authentication via Google Sign-In (using Auth.js) to enable persistent player profiles and ranked global leaderboard participation. When you sign in with Google, we store only what is needed: a stable user ID, display name, and email address. Your email is never displayed publicly or shared with third parties. No passwords are ever requested or stored.
            </p>
          </section>

          {/* Section 2: Cookies & Local Storage */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-pink-300 flex items-center gap-2">
              <Cookie size={16} /> 2. Cookies and Local Storage
            </h2>
            <p>
              Vanish XO utilizes modern browser <strong>localStorage</strong> to store client preferences such as audio toggles, sound effects state, cached achievements, tutorial view status, and your anonymous player ID.
            </p>
            <p>
              Cookies are small text files placed on your device to ensure website functionality, maintain secure sessions, and assist our analytics and third-party advertising partners in delivering tailored services.
            </p>
          </section>

          {/* Section 3: Third-Party Advertising & Google AdSense */}
          <section className="space-y-3 p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.06)]">
            <h2 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <Eye size={16} /> 3. Third-Party Advertising &amp; Google AdSense
            </h2>
            <p className="text-slate-300">
              We may partner with third-party advertising companies, including <strong>Google AdSense</strong>, to serve advertisements when you visit our website.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>
                Third-party vendors, including Google, use cookies (such as the DoubleClick cookie) to serve ads based on a user&apos;s prior visits to this website or other websites on the internet.
              </li>
              <li>
                Google&apos;s use of advertising cookies enables it and its partners to serve ads to our users based on their visits to our site and/or other sites on the Internet.
              </li>
              <li>
                Users may opt out of personalized advertising by visiting{' '}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 font-medium"
                >
                  Google Ads Settings <ExternalLink size={12} />
                </a>.
              </li>
              <li>
                Alternatively, users can opt out of third-party vendors&apos; use of cookies for personalized advertising by visiting{' '}
                <a
                  href="https://www.aboutads.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 font-medium"
                >
                  www.aboutads.info <ExternalLink size={12} />
                </a>.
              </li>
            </ul>
          </section>

          {/* Section 4: Analytics */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <UserCheck size={16} /> 4. Analytics Services
            </h2>
            <p>
              We may utilize privacy-friendly analytics tools (such as Vercel Web Analytics) to collect aggregated, non-personally identifiable diagnostic metrics. This data helps us monitor application health, optimize matchmaking speeds, identify browser rendering bugs, and enhance user experience.
            </p>
          </section>

          {/* Section 5: Children's Privacy */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-pink-300 flex items-center gap-2">
              <Shield size={16} /> 5. Children&apos;s Privacy (COPPA Compliance)
            </h2>
            <p>
              Vanish XO does not knowingly target, solicit, or collect personal data from children under the age of 13. If you believe a child under 13 has provided personal details on our service, please contact us immediately so we can promptly remove such records from our systems.
            </p>
          </section>

          {/* Section 6: Contact Information */}
          <section className="space-y-2 pt-2 border-t border-white/5">
            <h2 className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <Mail size={16} /> 6. Contact Information
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact our team at:
            </p>
            <p className="font-mono text-cyan-300">
              Email:{' '}
              <a
                href="mailto:[akhilwebsite.dev@gmail.com]"
                className="underline hover:text-cyan-200 transition-colors"
              >
                [akhilwebsite.dev@gmail.com]
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
