'use client';

import React from 'react';
import { Bot, Users, Volume2, VolumeX, RotateCcw, Share2, Award } from 'lucide-react';
import { GameState } from '@/lib/game';

import { useRouter } from 'next/navigation';
import { generateRoomCode } from '@/lib/types';

interface TopControlsProps {
  mode: 'bot' | 'pvp';
  onModeChange: (mode: 'bot' | 'pvp') => void;
  botDifficulty: 'easy' | 'medium' | 'hard';
  onDifficultyChange: (diff: 'easy' | 'medium' | 'hard') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRestart: () => void;
  state: GameState;
  score: { X: number; O: number };
  streak: number;
  onOpenProfile?: () => void;
  rankTierColor?: string;
}

export const TopControls: React.FC<TopControlsProps> = ({
  mode,
  onModeChange,
  botDifficulty,
  onDifficultyChange,
  soundEnabled,
  onToggleSound,
  onRestart,
  state,
  score,
  streak,
  onOpenProfile,
  rankTierColor,
}) => {
  const router = useRouter();

  const handleInvite = async () => {
    if (typeof window === 'undefined') return;
    const code = generateRoomCode();
    router.push(`/room/${code}?action=create`);
  };

  const isXTurn = state.turn === 'X' && state.winner === null;
  const isOTurn = state.turn === 'O' && state.winner === null;

  return (
    <div className="w-full max-w-[360px] mx-auto flex flex-col gap-2 px-1 select-none">
      {/* Top Utility Bar */}
      <div className="flex items-center justify-between">
        {/* Mode Toggle Icons */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-xl border border-white/10 backdrop-blur-md">
          <button
            type="button"
            id="mode-bot"
            aria-label="Play vs Bot"
            onClick={() => onModeChange('bot')}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              mode === 'bot'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot size={18} />
          </button>
          <button
            type="button"
            id="mode-pvp"
            aria-label="Pass and Play"
            onClick={() => onModeChange('pvp')}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
              mode === 'pvp'
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40 shadow-[0_0_10px_rgba(255,0,127,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={18} />
          </button>
        </div>

        {/* Bot Difficulty Selector (Only visible in Bot mode) */}
        {mode === 'bot' && (
          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-xl border border-white/10 text-[11px] font-bold">
            {(['easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                type="button"
                id={`diff-${diff}`}
                onClick={() => onDifficultyChange(diff)}
                className={`min-h-[44px] px-2.5 rounded-lg uppercase flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  botDifficulty === diff
                    ? 'bg-cyan-400 text-black font-extrabold shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff === 'medium' ? 'MED' : diff}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons: Profile, Sound, Share/Invite, Restart */}
        <div className="flex items-center gap-1">
          {/* Profile / Stats Button */}
          {onOpenProfile && (
            <button
              type="button"
              id="top-profile-btn"
              aria-label="Profile and Badges"
              onClick={onOpenProfile}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/80 text-amber-400 hover:text-amber-300 border transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
              style={{
                borderColor: rankTierColor ? `${rankTierColor}40` : 'rgba(255,255,255,0.1)',
              }}
            >
              <Award size={18} style={{ color: rankTierColor || '#eab308' }} />
            </button>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            id="toggle-sound"
            aria-label="Toggle Sound"
            onClick={onToggleSound}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                : 'bg-slate-900/80 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Invite a friend / Share Link */}
          <div className="relative">
            <button
              type="button"
              id="invite-friend"
              aria-label="Invite a Friend"
              onClick={handleInvite}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/80 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-200 cursor-pointer active:scale-95"
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Restart Round */}
          <button
            type="button"
            id="restart-round"
            aria-label="Restart Round"
            onClick={onRestart}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:rotate-180 border border-white/5 transition-all duration-300 cursor-pointer active:scale-95"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Visual Turn & Player Indicator Cards */}
      <div className="grid grid-cols-2 gap-2 items-center">
        {/* Player X Card (Cyan) */}
        <div
          className={`flex items-center justify-between h-11 px-2.5 rounded-xl transition-all duration-300 border ${
            isXTurn
              ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_16px_rgba(0,240,255,0.3)] scale-[1.01]'
              : 'bg-slate-900/40 border-white/5 opacity-70'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center font-black text-cyan-300 text-sm shadow-[0_0_8px_rgba(0,240,255,0.4)]">
              X
            </span>
            <span className="font-mono text-xs font-semibold text-cyan-200">
              {score.X}
            </span>
          </div>

          {/* Mark Age Dots (Shows active marks out of 3) */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((idx) => {
              const active = idx < state.movesX.length;
              const isOldestOfThree = state.movesX.length === 3 && idx === 0;

              return (
                <span
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    active
                      ? isOldestOfThree
                        ? 'bg-cyan-400/40 border border-cyan-300 animate-ping'
                        : 'bg-cyan-400 shadow-[0_0_6px_#00f0ff]'
                      : 'bg-slate-800 border border-white/10'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Player O / Bot Card (Pink) */}
        <div
          className={`flex items-center justify-between h-11 px-2.5 rounded-xl transition-all duration-300 border ${
            isOTurn
              ? 'bg-pink-950/40 border-pink-500/80 shadow-[0_0_16px_rgba(255,0,127,0.3)] scale-[1.01]'
              : 'bg-slate-900/40 border-white/5 opacity-70'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-400/50 flex items-center justify-center font-black text-pink-300 text-sm shadow-[0_0_8px_rgba(255,0,127,0.4)]">
              {mode === 'bot' ? <Bot size={15} /> : 'O'}
            </span>
            <span className="font-mono text-xs font-semibold text-pink-200">
              {score.O}
            </span>
          </div>

          {/* Mark Age Dots */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((idx) => {
              const active = idx < state.movesO.length;
              const isOldestOfThree = state.movesO.length === 3 && idx === 0;

              return (
                <span
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    active
                      ? isOldestOfThree
                        ? 'bg-pink-500/40 border border-pink-300 animate-ping'
                        : 'bg-pink-500 shadow-[0_0_6px_#ff007f]'
                      : 'bg-slate-800 border border-white/10'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Streak badge (Icons only) */}
      {streak > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-0.5 text-xs font-bold text-amber-400">
          <span>🔥</span>
          <span className="font-mono">{streak}</span>
        </div>
      )}
    </div>
  );
};
