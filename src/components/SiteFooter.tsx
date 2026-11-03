import React from 'react';
import Link from 'next/link';

export const SiteFooter: React.FC = () => {
  return (
    <footer className="w-full max-w-2xl mx-auto mt-8 sm:mt-12 pt-6 pb-8 px-4 border-t border-white/5 text-xs text-slate-400 select-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Navigation Links */}
        <nav aria-label="Footer Navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link
            href="/how-to-play"
            className="hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            How to Play
          </Link>
          <Link
            href="/about"
            className="hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            About
          </Link>
          <Link
            href="/privacy-policy"
            className="hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="hover:text-cyan-400 transition-colors font-medium cursor-pointer"
          >
            Contact
          </Link>
        </nav>

        {/* Copyright notice */}
        <div className="text-[11px] text-slate-500 font-mono tracking-tight text-center sm:text-right">
          &copy; 2026 Vanish XO. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
