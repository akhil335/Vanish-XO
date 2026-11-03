import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Mail, Clock, MessageSquare, Send } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Contact Us | Vanish XO Support & Feedback',
  description: 'Get in touch with the Vanish XO development team. Send questions, bug reports, feature requests, or partnership inquiries.',
};

export default function ContactPage() {
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
              <Mail size={11} /> GET IN TOUCH
            </span>
          </div>

          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer"
          >
            PLAY
          </Link>
        </header>

        {/* Contact Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-950/80 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <MessageSquare size={30} />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
              Contact Us
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              Have feedback, discovered a bug, or want to discuss a partnership? We would love to hear from you.
            </p>
          </div>

          {/* Email Box */}
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900/60 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.08)] flex flex-col items-center gap-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
              Direct Contact Email
            </span>
            <a
              href="mailto:[akhilwebsite.dev@gmail.com]"
              className="text-base sm:text-lg font-bold font-mono text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-2 underline break-all"
            >
              <Send size={16} />
              <span>[akhilwebsite.dev@gmail.com]</span>
            </a>
          </div>

          {/* Response Time Information */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/40 px-3.5 py-2 rounded-xl border border-white/5">
            <Clock size={14} className="text-amber-400" />
            <span>Typical response time: within 24 to 48 business hours.</span>
          </div>
        </div>

        {/* Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
