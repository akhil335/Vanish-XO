'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Medal,
  RotateCcw,
  Shield,
  Bot,
  Zap,
  Clock,
  Swords,
} from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { getPlayerName } from '@/lib/player';
import { SiteFooter } from '@/components/SiteFooter';
import { BotLeaderboardEntry, BotLeaderboardRecord } from '@/lib/bot-leaderboard';

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

export default function LeaderboardPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<'pvp' | 'bot'>('pvp');
  const [botDifficulty, setBotDifficulty] = useState<'medium' | 'hard'>('medium');

  // PvP Elo Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Bot Speedrun Leaderboard State
  const [botLeaderboard, setBotLeaderboard] = useState<BotLeaderboardEntry[]>([]);
  const [myBotRecord, setMyBotRecord] = useState<BotLeaderboardRecord | null>(null);
  const [botLoading, setBotLoading] = useState(false);

  // Read URL query parameters on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'bot') {
          setTab('bot');
        }
        if (params.get('diff') === 'hard') {
          setBotDifficulty('hard');
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fetchLeaderboard = useCallback(async (isManual = false) => {
    if (isManual) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/leaderboard?limit=50', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { leaderboard?: LeaderboardEntry[] };
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching PvP leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBotLeaderboard = useCallback(
    async (diff: 'medium' | 'hard', isManual = false) => {
      if (isManual) {
        setBotLoading(true);
      }
      try {
        const res = await fetch(`/api/leaderboard/bot?difficulty=${diff}&limit=50`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            leaderboard?: BotLeaderboardEntry[];
            myRecord?: BotLeaderboardRecord | null;
          };
          setBotLeaderboard(data.leaderboard || []);
          setMyBotRecord(data.myRecord || null);
        }
      } catch (err) {
        console.error('Error fetching bot leaderboard:', err);
      } finally {
        setBotLoading(false);
      }
    },
    []
  );

  // Initial load and listeners for PvP leaderboard
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLeaderboard();
      void fetchBotLeaderboard(botDifficulty);
    }, 0);

    const handleFocus = () => {
      void fetchLeaderboard();
      void fetchBotLeaderboard(botDifficulty);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchLeaderboard();
        void fetchBotLeaderboard(botDifficulty);
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
  }, [fetchLeaderboard, fetchBotLeaderboard, botDifficulty]);

  // Handle difficulty toggle for bot leaderboard
  const handleDifficultyChange = (diff: 'medium' | 'hard') => {
    setBotDifficulty(diff);
    void fetchBotLeaderboard(diff, true);
  };

  const handleRefresh = () => {
    if (tab === 'pvp') {
      void fetchLeaderboard(true);
    } else {
      void fetchBotLeaderboard(botDifficulty, true);
    }
  };

  const myPlayerId = session?.user?.id || '';
  const myPlayerName = getPlayerName(session?.user);
  const myPvpEntry = myPlayerId ? leaderboard.find((e) => e.playerId === myPlayerId) : null;
  const myBotEntry = myPlayerId ? botLeaderboard.find((e) => e.playerId === myPlayerId) : null;

  const currentLoading = tab === 'pvp' ? loading : botLoading;

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-3 py-4 sm:py-6 bg-[#06080d] text-white select-none overflow-x-hidden">
      <div className="w-full max-w-md flex flex-col items-center gap-4 my-auto">
        {/* Header Bar */}
        <header className="w-full max-w-[380px] flex items-center justify-between px-1">
          <Link
            href="/"
            id="back-home-btn"
            aria-label="Back to home"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex flex-col items-center">
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
              VANISH XO
            </h1>
            <span className="text-[10px] font-black tracking-widest uppercase text-amber-400/90 flex items-center gap-1">
              <Trophy size={11} /> GLOBAL RANKINGS
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={currentLoading}
            aria-label="Refresh Leaderboard"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-white/5 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={18} className={currentLoading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Category Tab Switcher: PvP Elo vs Bot Speedrun */}
        <div className="w-full max-w-[380px] p-1 rounded-2xl bg-slate-950 border border-white/10 flex items-center gap-1 shadow-lg">
          <button
            type="button"
            id="tab-pvp-btn"
            onClick={() => setTab('pvp')}
            className={`flex-1 py-2 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'pvp'
                ? 'bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords size={14} className={tab === 'pvp' ? 'text-cyan-400' : ''} />
            <span>PVP ELO</span>
          </button>

          <button
            type="button"
            id="tab-bot-btn"
            onClick={() => setTab('bot')}
            className={`flex-1 py-2 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'bot'
                ? 'bg-gradient-to-r from-purple-500/25 to-pink-500/25 border border-purple-400/50 text-purple-300 shadow-[0_0_12px_rgba(176,38,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot size={14} className={tab === 'bot' ? 'text-purple-400' : ''} />
            <span>AI SPEEDRUN</span>
          </button>
        </div>

        {/* Sub-header System Badges & Difficulty Sub-tabs */}
        {tab === 'pvp' ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] font-mono text-slate-400">
            <Shield size={12} className="text-cyan-400" />
            <span>Elo System · Base: 1000 · K: 32</span>
          </div>
        ) : (
          <div className="w-full max-w-[380px] flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-purple-500/20 text-[11px] font-mono text-purple-300">
              <Zap size={12} className="text-yellow-400" />
              <span>Ranked by Fewest Moves · Tiebreaker: Time</span>
            </div>

            {/* Difficulty Sub-tabs (Medium vs Hard) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="bot-diff-medium-btn"
                onClick={() => handleDifficultyChange('medium')}
                className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase transition-all cursor-pointer border ${
                  botDifficulty === 'medium'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                MEDIUM AI
              </button>
              <button
                type="button"
                id="bot-diff-hard-btn"
                onClick={() => handleDifficultyChange('hard')}
                className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase transition-all cursor-pointer border ${
                  botDifficulty === 'hard'
                    ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_10px_rgba(176,38,255,0.3)]'
                    : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                HARD AI
              </button>
            </div>
          </div>
        )}

        {/* Guest Notification Banner */}
        {status !== 'loading' && !session?.user && (
          <div className="w-full max-w-[380px] p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-200">Playing as Guest</span>
              <span className="text-[11px] text-slate-400">
                {tab === 'pvp'
                  ? 'Sign in to join the PvP Elo leaderboard'
                  : 'Sign in to record your fewest moves against the AI'}
              </span>
            </div>
            <button
              type="button"
              id="guest-leaderboard-signin-btn"
              onClick={() => signIn('google')}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-md hover:bg-cyan-300 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Player's Own Rank Card */}
        {tab === 'pvp' && myPvpEntry && (
          <div className="w-full max-w-[380px] p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center font-black text-cyan-300 text-sm shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                #{myPvpEntry.rank}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-cyan-200">
                    {myPvpEntry.playerName || myPlayerName || 'You'}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    YOU
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {myPvpEntry.wins}W - {myPvpEntry.losses}L · {myPvpEntry.gamesPlayed} played
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-base font-black text-cyan-300">
                {myPvpEntry.rating}
              </span>
              <span className="text-[10px] font-semibold text-cyan-400/80 tracking-wider">
                RATING
              </span>
            </div>
          </div>
        )}

        {tab === 'bot' && (myBotEntry || myBotRecord) && (
          <div className="w-full max-w-[380px] p-3 rounded-2xl bg-purple-950/30 border border-purple-500/40 shadow-[0_0_15px_rgba(176,38,255,0.15)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center font-black text-purple-300 text-sm shadow-[0_0_8px_rgba(176,38,255,0.3)]">
                {myBotEntry ? `#${myBotEntry.rank}` : '✓'}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-purple-200">
                    {myBotEntry?.playerName || myBotRecord?.playerName || myPlayerName || 'You'}
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    YOU
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>{botDifficulty.toUpperCase()} AI</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-yellow-400" />
                    {myBotEntry?.durationSeconds ?? myBotRecord?.durationSeconds}s
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-base font-black text-purple-300">
                {myBotEntry?.moves ?? myBotRecord?.moves}
              </span>
              <span className="text-[10px] font-semibold text-purple-400/80 tracking-wider">
                MOVES
              </span>
            </div>
          </div>
        )}

        {/* Leaderboard Container */}
        <div className="w-full max-w-[380px] bg-slate-950/80 border border-white/10 rounded-3xl p-3 shadow-2xl backdrop-blur-md min-h-[300px] flex flex-col">
          {tab === 'pvp' ? (
            /* ================== PVP ELO LIST ================== */
            loading && leaderboard.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center gap-3 p-8 text-cyan-400">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs tracking-widest uppercase">
                  LOADING RANKINGS...
                </span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                  <Trophy size={36} />
                </div>
                <div className="flex flex-col gap-1 max-w-[280px]">
                  <p className="text-sm font-semibold text-slate-300 leading-snug">
                    No one is ranked yet. Be the first on the global leaderboard!
                  </p>
                </div>
                <Link
                  href="/"
                  className="mt-2 px-6 py-2.5 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer"
                >
                  PLAY NOW
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[60vh] pr-1">
                {leaderboard.map((player) => {
                  const isMe = player.playerId === myPlayerId;
                  const isFirst = player.rank === 1;
                  const isSecond = player.rank === 2;
                  const isThird = player.rank === 3;

                  return (
                    <div
                      key={player.playerId}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isMe
                          ? 'bg-cyan-950/40 border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                          : isFirst
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          : isSecond
                          ? 'bg-slate-800/40 border-slate-400/40'
                          : isThird
                          ? 'bg-amber-900/15 border-amber-700/30'
                          : 'bg-slate-900/40 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-black text-xs border ${
                            isFirst
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                              : isSecond
                              ? 'bg-slate-300/20 border-slate-300/50 text-slate-200 shadow-sm'
                              : isThird
                              ? 'bg-amber-800/20 border-amber-700/40 text-amber-500 shadow-sm'
                              : 'bg-slate-900 border-white/10 text-slate-400'
                          }`}
                        >
                          {isFirst ? <Medal size={14} /> : `#${player.rank}`}
                        </span>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold text-xs truncate max-w-[140px] ${
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
                          <span className="text-[10px] font-mono text-slate-500">
                            {player.wins}W - {player.losses}L ({player.gamesPlayed}G)
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span
                          className={`font-mono text-sm font-black ${
                            isFirst
                              ? 'text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                              : isMe
                              ? 'text-cyan-300'
                              : 'text-white'
                          }`}
                        >
                          {player.rating}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          ELO
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ================== BOT SPEEDRUN LIST ================== */
            botLoading && botLeaderboard.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center gap-3 p-8 text-purple-400">
                <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs tracking-widest uppercase">
                  LOADING AI SPEEDRUNS...
                </span>
              </div>
            ) : botLeaderboard.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_25px_rgba(176,38,255,0.25)]">
                  <Bot size={36} />
                </div>
                <div className="flex flex-col gap-1 max-w-[280px]">
                  <p className="text-sm font-semibold text-slate-300 leading-snug">
                    No one has ranked against the {botDifficulty} AI yet. Be the first to defeat it in
                    the fewest moves!
                  </p>
                </div>
                <Link
                  href="/?mode=bot"
                  className="mt-2 px-6 py-2.5 rounded-xl bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:bg-purple-400 active:scale-95 transition-all cursor-pointer"
                >
                  PLAY VS BOT
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[60vh] pr-1">
                {botLeaderboard.map((player) => {
                  const isMe = player.playerId === myPlayerId;
                  const isFirst = player.rank === 1;
                  const isSecond = player.rank === 2;
                  const isThird = player.rank === 3;

                  return (
                    <div
                      key={player.playerId}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isMe
                          ? 'bg-purple-950/40 border-purple-400/60 shadow-[0_0_12px_rgba(176,38,255,0.2)]'
                          : isFirst
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          : isSecond
                          ? 'bg-slate-800/40 border-slate-400/40'
                          : isThird
                          ? 'bg-amber-900/15 border-amber-700/30'
                          : 'bg-slate-900/40 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-black text-xs border ${
                            isFirst
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                              : isSecond
                              ? 'bg-slate-300/20 border-slate-300/50 text-slate-200 shadow-sm'
                              : isThird
                              ? 'bg-amber-800/20 border-amber-700/40 text-amber-500 shadow-sm'
                              : 'bg-slate-900 border-white/10 text-slate-400'
                          }`}
                        >
                          {isFirst ? <Medal size={14} /> : `#${player.rank}`}
                        </span>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold text-xs truncate max-w-[130px] ${
                                isMe
                                  ? 'text-purple-300'
                                  : isFirst
                                  ? 'text-amber-200'
                                  : 'text-slate-200'
                              }`}
                            >
                              {player.playerName}
                            </span>
                            {isMe && (
                              <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-purple-400/20 text-purple-300 border border-purple-400/40 shrink-0">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Clock size={10} className="text-slate-400" />
                              {player.durationSeconds}s
                            </span>
                            <span>·</span>
                            <span className="capitalize">{player.difficulty} AI</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`font-mono text-base font-black ${
                              isFirst
                                ? 'text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                                : isMe
                                ? 'text-purple-300'
                                : 'text-white'
                            }`}
                          >
                            {player.moves}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            MOVES
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          {player.turns} turns
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Site Footer */}
        <SiteFooter />
      </div>
    </main>
  );
}
