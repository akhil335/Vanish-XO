'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Medal, ChevronRight, Swords, Bot, Clock } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { BotLeaderboardEntry } from '@/lib/bot-leaderboard';

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
  const [activeTab, setActiveTab] = useState<'pvp' | 'bot'>('pvp');
  const [botDiff, setBotDiff] = useState<'medium' | 'hard'>('medium');

  const [pvpEntries, setPvpEntries] = useState<LeaderboardEntry[]>([]);
  const [pvpLoading, setPvpLoading] = useState(true);

  const [botEntries, setBotEntries] = useState<BotLeaderboardEntry[]>([]);
  const [botLoading, setBotLoading] = useState(false);

  const fetchTopPvp = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=5', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] };
        setPvpEntries(data.leaderboard ? data.leaderboard.slice(0, 5) : []);
      }
    } catch (err) {
      console.error('Failed to load top 5 PvP leaderboard:', err);
    } finally {
      setPvpLoading(false);
    }
  }, []);

  const fetchTopBot = useCallback(async (diff: 'medium' | 'hard') => {
    setBotLoading(true);
    try {
      const res = await fetch(`/api/leaderboard/bot?difficulty=${diff}&limit=5`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { leaderboard?: BotLeaderboardEntry[] };
        setBotEntries(data.leaderboard ? data.leaderboard.slice(0, 5) : []);
      }
    } catch (err) {
      console.error('Failed to load top 5 bot leaderboard:', err);
    } finally {
      setBotLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTopPvp();
      void fetchTopBot(botDiff);
    }, 0);

    const handleFocus = () => {
      void fetchTopPvp();
      void fetchTopBot(botDiff);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchTopPvp();
        void fetchTopBot(botDiff);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('vanish_xo_leaderboard_updated', handleFocus);
    window.addEventListener('vanish_xo_bot_leaderboard_updated', handleFocus);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('vanish_xo_leaderboard_updated', handleFocus);
      window.removeEventListener('vanish_xo_bot_leaderboard_updated', handleFocus);
    };
  }, [fetchTopPvp, fetchTopBot, botDiff]);

  const handleBotDiffChange = (diff: 'medium' | 'hard') => {
    setBotDiff(diff);
    void fetchTopBot(diff);
  };

  const myPlayerId = session?.user?.id || '';
  const currentLoading = activeTab === 'pvp' ? pvpLoading : botLoading;
  const viewAllHref =
    activeTab === 'pvp' ? '/leaderboard' : `/leaderboard?tab=bot&diff=${botDiff}`;

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
          href={viewAllHref}
          id="home-leaderboard-view-all"
          className="text-[11px] font-extrabold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 transition-colors cursor-pointer group"
          aria-label="View full leaderboard"
        >
          <span>VIEW ALL</span>
          <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Mode Switcher: PVP vs AI */}
      <div className="flex items-center justify-between gap-1 p-0.5 rounded-xl bg-slate-900 border border-white/5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pvp')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'pvp'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Swords size={11} />
            <span>PVP ELO</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bot')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'bot'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot size={11} />
            <span>AI SPEEDRUN</span>
          </button>
        </div>

        {activeTab === 'bot' && (
          <div className="flex items-center gap-1 pr-0.5">
            <button
              type="button"
              onClick={() => handleBotDiffChange('medium')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                botDiff === 'medium'
                  ? 'bg-cyan-400/30 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MED
            </button>
            <button
              type="button"
              onClick={() => handleBotDiffChange('hard')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                botDiff === 'hard'
                  ? 'bg-purple-400/30 text-purple-200 border border-purple-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              HARD
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {currentLoading ? (
        <div className="py-5 flex items-center justify-center gap-2 text-cyan-400">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-[10px] tracking-widest uppercase">
            LOADING RANKINGS...
          </span>
        </div>
      ) : activeTab === 'pvp' ? (
        /* Top 5 PvP */
        pvpEntries.length === 0 ? (
          <div className="py-4 px-2 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center gap-2 text-center">
            <Trophy size={20} className="text-amber-400/70" />
            <p className="text-xs font-semibold text-slate-300 max-w-[260px] leading-relaxed">
              No one is ranked yet. Play online to be first!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pvpEntries.map((player) => {
              const isMe = player.playerId === myPlayerId;
              const isFirst = player.rank === 1;

              return (
                <div
                  key={player.playerId}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-cyan-950/40 border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                      : isFirst
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-slate-900/40 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 shrink-0 rounded flex items-center justify-center font-black text-[10px] border ${
                        isFirst
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-slate-900 border-white/10 text-slate-400'
                      }`}
                    >
                      {isFirst ? <Medal size={11} /> : `#${player.rank}`}
                    </span>
                    <span
                      className={`font-bold text-xs truncate max-w-[130px] ${
                        isMe ? 'text-cyan-300' : isFirst ? 'text-amber-200' : 'text-slate-200'
                      }`}
                    >
                      {player.playerName}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      className={`font-mono text-xs font-black ${
                        isFirst ? 'text-amber-300' : isMe ? 'text-cyan-300' : 'text-white'
                      }`}
                    >
                      {player.rating}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">ELO</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Top 5 AI Speedrun */
        botEntries.length === 0 ? (
          <div className="py-4 px-2 rounded-xl bg-slate-900/40 border border-white/5 flex flex-col items-center justify-center gap-2 text-center">
            <Bot size={20} className="text-purple-400/70" />
            <p className="text-xs font-semibold text-slate-300 max-w-[260px] leading-relaxed">
              No one has ranked against {botDiff} AI yet. Beat it in fewest moves!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {botEntries.map((player) => {
              const isMe = player.playerId === myPlayerId;
              const isFirst = player.rank === 1;

              return (
                <div
                  key={player.playerId}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-purple-950/40 border-purple-400/50 shadow-[0_0_10px_rgba(176,38,255,0.15)]'
                      : isFirst
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-slate-900/40 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 shrink-0 rounded flex items-center justify-center font-black text-[10px] border ${
                        isFirst
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-slate-900 border-white/10 text-slate-400'
                      }`}
                    >
                      {isFirst ? <Medal size={11} /> : `#${player.rank}`}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-bold text-xs truncate max-w-[120px] ${
                          isMe ? 'text-purple-300' : isFirst ? 'text-amber-200' : 'text-slate-200'
                        }`}
                      >
                        {player.playerName}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 flex items-center gap-0.5">
                        <Clock size={8} className="text-slate-400" />
                        {player.durationSeconds}s
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 shrink-0">
                    <span
                      className={`font-mono text-xs font-black ${
                        isFirst ? 'text-amber-300' : isMe ? 'text-purple-300' : 'text-white'
                      }`}
                    >
                      {player.moves}
                    </span>
                    <span className="text-[9px] font-bold text-purple-400 uppercase">MOVES</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Guest Sign-In Teaser */}
      {status !== 'loading' && !session?.user && (
        <div className="pt-1 border-t border-white/5 flex items-center justify-between px-1">
          <span className="text-[10px] text-slate-400">Want to join rankings?</span>
          <button
            type="button"
            id="home-leaderboard-signin-btn"
            onClick={() => signIn('google')}
            className="text-[10px] font-extrabold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
      )}
    </section>
  );
}
