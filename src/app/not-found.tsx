import Link from 'next/link';
import { DoorClosed, HelpCircle, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#06080d] text-white select-none">
      <div className="relative max-w-[280px] w-full bg-[#0a0d16]/90 border border-amber-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl backdrop-blur-md">
        {/* Question-mark door icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <DoorClosed size={36} />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs shadow-md">
            <HelpCircle size={14} strokeWidth={3} className="text-black" />
          </div>
        </div>

        <span className="font-black text-xs tracking-widest uppercase text-amber-300/80">NOT FOUND</span>

        <Link
          href="/"
          className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-cyan-400 hover:text-cyan-300 transition-all"
          aria-label="Home"
        >
          <Home size={16} />
          <span>HOME</span>
        </Link>
      </div>
    </main>
  );
}
