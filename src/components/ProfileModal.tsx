'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bot,
  Flame,
  Trophy,
  Shield,
  Users,
  Timer,
  Award,
} from 'lucide-react';
import {
  ProgressionData,
  getRank,
  getBadges,
  GameMode,
  GAME_MODES,
  OPPONENT_TYPES,
  OpponentType,
} from '@/lib/progress';
import { renderBadgeIcon } from './BadgeToast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProgressionData;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, data }) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('2P');
  const [activeBadgeTooltip, setActiveBadgeTooltip] = useState<string | null>(null);

  if (!isOpen) return null;

  const rankInfo = getRank(data.rankPoints);
  const badges = getBadges(data);
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-[390px] max-h-[90vh] flex flex-col bg-slate-950/95 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-md"
                style={{
                  borderColor: `${rankInfo.color}88`,
                  backgroundColor: `${rankInfo.color}15`,
                  boxShadow: `0 0 12px ${rankInfo.glow}`,
                }}
              >
                <Shield size={18} style={{ color: rankInfo.color }} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span
                    id="profile-title"
                    className="text-sm font-black tracking-wider uppercase"
                    style={{ color: rankInfo.color }}
                  >
                    {rankInfo.name}
                  </span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-extrabold text-cyan-300">
                    <Bot size={11} />
                    <span>PRACTICE</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {rankInfo.points} PTS {rankInfo.nextTier ? `· ${rankInfo.pointsToNext} TO ${rankInfo.nextTier}` : '· MAX'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5">
            {/* Rank Progress Bar */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-2xl bg-slate-900/40 border border-white/5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400">TIER PROGRESS</span>
                <span className="font-mono" style={{ color: rankInfo.color }}>
                  {rankInfo.progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${rankInfo.progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: rankInfo.color,
                    boxShadow: `0 0 10px ${rankInfo.color}`,
                  }}
                />
              </div>
            </div>

            {/* Quick Metrics (Streak, Wins, Games) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-slate-900/50 border border-white/5">
                <div className="flex items-center gap-1 text-orange-400 mb-0.5">
                  <Flame size={14} />
                  <span className="font-mono text-xs font-black">{data.overall.currentStreak}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  STREAK
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  BEST {data.overall.bestStreak}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-slate-900/50 border border-white/5">
                <div className="flex items-center gap-1 text-cyan-400 mb-0.5">
                  <Trophy size={14} />
                  <span className="font-mono text-xs font-black">{data.overall.wins}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  WINS
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  TOTAL {data.overall.gamesPlayed}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl bg-slate-900/50 border border-white/5">
                <div className="flex items-center gap-1 text-yellow-300 mb-0.5">
                  <Timer size={14} />
                  <span className="font-mono text-xs font-black">
                    {data.overall.fastestWin ? `${data.overall.fastestWin}m` : '—'}
                  </span>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  FASTEST
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  TURNS
                </span>
              </div>
            </div>

            {/* Badges Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-300 uppercase">
                  <Award size={14} className="text-amber-400" />
                  <span>BADGES</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 font-bold">
                  {unlockedCount} / {badges.length}
                </span>
              </div>

              {/* 5x2 Grid of Badges */}
              <div className="grid grid-cols-5 gap-1.5">
                {badges.map((badge) => {
                  const isHovered = activeBadgeTooltip === badge.id;

                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() =>
                        setActiveBadgeTooltip(isHovered ? null : badge.id)
                      }
                      onMouseEnter={() => setActiveBadgeTooltip(badge.id)}
                      onMouseLeave={() => setActiveBadgeTooltip(null)}
                      className={`group relative aspect-square rounded-2xl flex flex-col items-center justify-center p-1.5 border transition-all duration-200 cursor-pointer ${
                        badge.isUnlocked
                          ? 'bg-slate-900/90 border-cyan-500/50 shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:scale-105'
                          : 'bg-slate-950/40 border-dashed border-white/10 opacity-35 hover:opacity-60'
                      }`}
                    >
                      <div className="relative">
                        {renderBadgeIcon(badge.icon, 18)}
                      </div>
                      <span className="text-[9px] font-extrabold text-slate-300 truncate max-w-full mt-1">
                        {badge.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Badge Tooltip / Description bar */}
              <div className="min-h-[32px] px-2.5 py-1.5 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between text-xs">
                {activeBadgeTooltip ? (
                  (() => {
                    const badge = badges.find((b) => b.id === activeBadgeTooltip);
                    if (!badge) return null;
                    return (
                      <>
                        <span className="text-slate-200 font-medium text-[11px]">
                          {badge.description}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider font-mono ${
                            badge.isUnlocked ? 'text-cyan-400' : 'text-slate-500'
                          }`}
                        >
                          {badge.isUnlocked ? 'EARNED' : 'LOCKED'}
                        </span>
                      </>
                    );
                  })()
                ) : (
                  <span className="text-slate-500 text-[11px]">
                    TAP BADGE FOR DETAILS
                  </span>
                )}
              </div>
            </div>

            {/* Stats Breakdown (Per Mode & Opponent) */}
            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
                  RECORD
                </span>

                {/* Mode Selector (2P / 3P / 4P) */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-white/10">
                  {GAME_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedMode(mode)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                        selectedMode === mode
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opponent Rows */}
              <div className="flex flex-col gap-1.5">
                {OPPONENT_TYPES.map((opp: OpponentType) => {
                  const slice = data.stats[selectedMode][opp];
                  const hasData = slice.gamesPlayed > 0;

                  return (
                    <div
                      key={opp}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/40 border border-white/5 text-xs font-bold"
                    >
                      <div className="flex items-center gap-2">
                        {opp === 'human' ? (
                          <Users size={14} className="text-pink-400" />
                        ) : (
                          <Bot
                            size={14}
                            className={
                              opp === 'Easy'
                                ? 'text-emerald-400'
                                : opp === 'Medium'
                                ? 'text-cyan-400'
                                : 'text-purple-400'
                            }
                          />
                        )}
                        <span className="text-slate-200 uppercase tracking-wide text-[11px]">
                          {opp}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-slate-300">
                          {slice.wins}W / {slice.losses}L
                        </span>
                        <span className="text-orange-400">
                          🔥{slice.currentStreak}
                        </span>
                        <span className="text-slate-500 text-[10px] min-w-[32px] text-right">
                          {hasData && slice.fastestWin ? `${slice.fastestWin}m` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
