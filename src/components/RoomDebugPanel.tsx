'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoomState } from '@/lib/types';
import { Bug, ChevronDown, ChevronUp, Crown } from 'lucide-react';

interface RoomDebugPanelProps {
  roomState: RoomState | null;
  myPlayerId: string;
  isHost?: boolean;
  lastStateTime?: number | null;
}

export const RoomDebugPanel: React.FC<RoomDebugPanelProps> = ({
  roomState,
  myPlayerId,
  isHost: isHostProp,
  lastStateTime,
}) => {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const isDev = process.env.NODE_ENV === 'development';
  const isDebugParam = searchParams?.get('debug') === '1';

  if (!isDev && !isDebugParam) {
    return null;
  }

  const hostPlayerId = roomState?.hostPlayerId ?? null;
  const isHost = isHostProp !== undefined ? isHostProp : Boolean(hostPlayerId && myPlayerId && hostPlayerId === myPlayerId);
  const phase = roomState?.phase ?? roomState?.status ?? 'none';
  const canStart = Boolean(roomState?.canStart);
  const blockReasons = roomState?.blockReasons ?? [];
  const seats = roomState?.seats ?? [];
  const seatCount = roomState?.seatCount ?? roomState?.seatsCount ?? 0;
  const readyCount = roomState?.readyCount ?? 0;
  const requiredCount = roomState?.requiredCount ?? roomState?.seatsCount ?? 0;

  return (
    <aside
      aria-label="Room Debug Panel"
      className="fixed bottom-2 left-2 z-50 max-w-sm w-full font-mono text-[11px] select-text"
    >
      <div className="bg-slate-950/95 border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-slate-300">
        {/* Header / Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-3 py-2 bg-slate-900/90 hover:bg-slate-800/90 flex items-center justify-between transition-colors border-b border-white/5 cursor-pointer text-left"
          aria-expanded={isOpen}
          aria-controls="debug-panel-content"
        >
          <div className="flex items-center gap-2">
            <Bug size={14} className="text-cyan-400" />
            <span className="font-bold text-cyan-300 tracking-wider">DEBUG PANEL</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                canStart ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              canStart: {String(canStart)}
            </span>
          </div>
          {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
        </button>

        {/* Collapsible Content */}
        {isOpen && (
          <div id="debug-panel-content" className="p-3 flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto">
            {/* Core Flags */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-2 rounded-lg border border-white/5">
              <div>
                <span className="text-slate-500 block text-[10px]">MY PLAYER ID</span>
                <span className="text-cyan-300 font-bold break-all">{myPlayerId || 'none'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">HOST PLAYER ID</span>
                <span className="text-amber-400 font-bold break-all flex items-center gap-1">
                  {hostPlayerId ? (
                    <>
                      <Crown size={11} className="text-amber-400 inline" />
                      {hostPlayerId}
                    </>
                  ) : (
                    'null'
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">IS HOST</span>
                <span className={`font-bold ${isHost ? 'text-amber-400' : 'text-slate-400'}`}>
                  {String(isHost)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">PHASE</span>
                <span className="text-cyan-400 font-bold uppercase">{phase}</span>
              </div>
            </div>

            {/* Timing & State */}
            <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 text-[10px]">
              <span className="text-slate-400">LAST STATE RCVD:</span>
              <span className="text-white font-bold">
                {lastStateTime ? new Date(lastStateTime).toLocaleTimeString() : 'none'}
              </span>
            </div>

            {/* Counts & Readiness */}
            <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
              <span>Ready: <strong className="text-emerald-400">{readyCount}</strong> / {requiredCount} (Seats: {seatCount})</span>
              <span>canStart: <strong className={canStart ? 'text-emerald-400' : 'text-rose-400'}>{String(canStart)}</strong></span>
            </div>

            {/* Block Reasons */}
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-slate-500 block text-[10px] mb-1">BLOCK REASONS</span>
              {blockReasons.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {blockReasons.map((r, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                      {r}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-emerald-400 font-bold text-[10px]">NONE (Ready to start)</span>
              )}
            </div>

            {/* Seats Table */}
            <div className="bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-slate-500 block text-[10px] mb-1">SEATS & FLAGS</span>
              <div className="flex flex-col gap-1.5">
                {seats.map((seat) => {
                  const isSeatHost = seat.playerId === hostPlayerId && hostPlayerId !== null;
                  const isMe = seat.playerId === myPlayerId;
                  const readyFlag = Boolean(seat.ready ?? seat.isReady);
                  const connectedFlag = Boolean(seat.connected ?? seat.isConnected);
                  const kind = seat.kind ?? (seat.isBot ? 'bot' : seat.playerId ? 'human' : 'empty');

                  return (
                    <div
                      key={seat.seatIndex}
                      className="flex flex-col gap-0.5 p-1.5 rounded bg-slate-900/60 border border-white/5 text-[10px]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-cyan-300">[{seat.seatIndex}]</span>
                          <span className="font-bold text-white">{seat.symbol}</span>
                          <span className="text-slate-400">({kind})</span>
                          {isSeatHost && <Crown size={10} className="text-amber-400 fill-amber-400" />}
                          {isMe && <span className="text-cyan-400 font-bold">(me)</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={readyFlag ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                            R:{readyFlag ? '✓' : '✗'}
                          </span>
                          <span className={connectedFlag ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                            C:{connectedFlag ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-500 truncate">
                        playerId: <span className="text-slate-400">{seat.playerId || 'null'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
