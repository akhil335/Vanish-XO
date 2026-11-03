'use client';

import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, User } from 'lucide-react';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="h-7 px-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center gap-1.5 text-slate-500 text-[11px] animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        <span>Loading...</span>
      </div>
    );
  }

  if (session?.user) {
    const displayName = session.user.name || 'Player';

    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0" title={`Signed in as ${displayName}`}>
          <User size={13} className="text-cyan-400 shrink-0" />
          <span className="font-bold text-cyan-200 truncate max-w-[95px] sm:max-w-[125px] text-[11px] sm:text-xs">
            {displayName}
          </span>
        </div>
        <div className="w-[1px] h-3.5 bg-white/10 shrink-0" />
        <button
          type="button"
          id="auth-signout-btn"
          onClick={() => signOut()}
          className="text-[10px] font-black uppercase text-slate-400 hover:text-pink-400 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={11} />
          <span className="hidden xs:inline">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      id="auth-signin-btn"
      onClick={() => signIn('google')}
      className="h-7 px-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-400 hover:text-white hover:border-cyan-400 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.15)] hover:shadow-[0_0_14px_rgba(0,240,255,0.3)] active:scale-95 cursor-pointer"
      aria-label="Sign in with Google"
    >
      <LogIn size={12} className="text-cyan-400" />
      <span>Sign in</span>
    </button>
  );
}
