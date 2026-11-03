'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Medal, ChevronRight } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export function HomeLeaderboard() {
  const { data: session, status } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchTopFive() {
      try {
        const res = await fetch('/api/leaderboard?limit=5', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] };
          if (isMounted) {
            setEntries(data.leaderboard ? data.leaderboard.slice(0, 5) : []);
          }
        }
      } catch (err) {
        console.error('Failed to load top 5 leaderboard:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchTopFive();

    const handleFocus = () => {
      fetchTopFive();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTopFive();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('vanish_xo_leaderboard_updated', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('vanish_xo_leaderboard_updated', handleFocus);
    };
  }, []);

  const myPlayerId = session?.user?.id || '';

  return (
    <section
      aria-label="Top 5 Leaderboard"
      className="w-full max-w-[360px] bg-slate-950/80 border border-white/10 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-col gap-2.5 transition-all select-none"
    >
      {/* Header with Title and Full Leaderboard link */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <Trophy size={14} className="text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
          <h2 className="text-xs font-black tracking-wider uppercase text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]">
            TOP PLAYERS
          </h2>
        </div>

        <Link
          href="/leaderboard"
          id="home-leaderboard-view-all"
          className="text-[11px] font-extrabold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors cursor-pointer group"
          aria-label="View full leaderboard"
        >
          <span>VIEW ALL</span>
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Content */}
      {loading && entries.length === 0 ? (
        <div className="py-5 flex items-center justify-center gap-2 text-cyan-400">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-[10px] tracking-widest uppercase">LOADING TOP 5...</span>
        </div>
      ) : entries.length === 0 ? (
        /* Empty State */
        <div className="py-4 px-2 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center gap-2 text-center">
          <Trophy size={22} className="text-amber-400/70 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
          <p className="text-xs font-semibold text-slate-300 max-w-[260px] leading-relaxed">
            No one is ranked yet. Be the first on the global leaderboard!
          </p>
        </div>
      ) : (
        /* Top 5 List */
        <div className="flex flex-col gap-1.5">
          {entries.map((player) => {
            const isMe = player.playerId === myPlayerId;
            const isFirst = player.rank === 1;
            const isSecond = player.rank === 2;
            const isThird = player.rank === 3;

            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                  isMe
                    ? 'bg-cyan-950/40 border-cyan-400/60 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                    : isFirst
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                    : isSecond
                    ? 'bg-slate-800/40 border-slate-400/40'
                    : isThird
                    ? 'bg-amber-900/15 border-amber-700/30'
                    : 'bg-slate-900/40 border-white/5'
                }`}
              >
                {/* Rank & Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center font-black text-[11px] border ${
                      isFirst
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                        : isSecond
                        ? 'bg-slate-300/20 border-slate-300/50 text-slate-200'
                        : isThird
                        ? 'bg-amber-800/20 border-amber-700/40 text-amber-500'
                        : 'bg-slate-900 border-white/10 text-slate-400'
                    }`}
                  >
                    {isFirst ? <Medal size={12} /> : `#${player.rank}`}
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`font-bold text-xs truncate max-w-[160px] ${
                        isMe
                          ? 'text-cyan-300'
                          : isFirst
                          ? 'text-amber-200'
                          : 'text-slate-200'
                      }`}
                    >
                      {player.playerName}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 shrink-0">
                        YOU
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <span
                    className={`font-mono text-xs font-black ${
                      isFirst
                        ? 'text-amber-300'
                        : isMe
                        ? 'text-cyan-300'
                        : 'text-white'
                    }`}
                  >
                    {player.rating}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                    ELO
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {status !== 'loading' && !session?.user && (
        <div className="mt-1 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400 font-medium leading-tight">
            Sign in to join the global leaderboard
          </p>
          <button
            type="button"
            id="home-leaderboard-signin-btn"
            onClick={() => signIn('google')}
            className="text-[10px] font-black uppercase text-cyan-400 hover:text-white px-2 py-0.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 shrink-0 cursor-pointer transition-colors"
          >
            Sign in
          </button>
        </div>
      )}
    </section>
  );
}
