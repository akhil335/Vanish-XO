'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomChatMessage, PlayerSeat, SEAT_COLORS } from '@/lib/types';
import {
  MessageSquare,
  X,
  Send,
  Volume2,
  VolumeX,
  MessageSquareOff,
  Flag,
  Check,
  AlertCircle,
  EyeOff,
} from 'lucide-react';

interface RoomChatProps {
  roomCode: string;
  seatsCount: number;
  mySeatIndex: number | null;
  seats: PlayerSeat[];
  messages: RoomChatMessage[];
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const RoomChat: React.FC<RoomChatProps> = ({
  roomCode,
  seatsCount,
  mySeatIndex,
  seats,
  messages,
  onSendMessage,
  disabled = false,
}) => {
  // If not a 2P room, render nothing
  if (seatsCount !== 2) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isChatOff, setIsChatOff] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportedMessageIds, setReportedMessageIds] = useState<Record<string, boolean>>({});
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportSuccessId, setReportSuccessId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSeenCountRef = useRef<number>(0);

  // Opponent seat info
  const opponentSeat = seats.find((s) => s.seatIndex !== mySeatIndex);
  const isOpponentConnected = Boolean(opponentSeat && (opponentSeat.isConnected ?? opponentSeat.connected));
  const opponentName = opponentSeat?.playerName || opponentSeat?.name || 'Opponent';

  // Handle unread counts
  useEffect(() => {
    if (isChatOff) {
      setUnreadCount(0);
      return;
    }
    if (isOpen) {
      setUnreadCount(0);
      lastSeenCountRef.current = messages.length;
    } else {
      const newMessages = messages.slice(lastSeenCountRef.current);
      const incomingUnread = newMessages.filter(
        (m) => m.seatIndex !== mySeatIndex && (!isMuted || m.seatIndex === mySeatIndex)
      ).length;
      setUnreadCount(incomingUnread);
    }
  }, [messages, isOpen, mySeatIndex, isMuted, isChatOff]);

  // Scroll to bottom when new messages arrive and panel is open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || isChatOff || !isOpponentConnected) return;

    const trimmed = inputText.trim();
    if (!trimmed || trimmed.length > 120) return;

    onSendMessage(trimmed);
    setInputText('');
  };

  const handleReport = async (msg: RoomChatMessage) => {
    if (reportingId || reportedMessageIds[msg.id]) return;
    setReportingId(msg.id);

    try {
      const res = await fetch('/api/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          reportedSeat: msg.seatIndex,
          messageText: msg.text,
        }),
      });

      if (res.ok) {
        setReportedMessageIds((prev) => ({ ...prev, [msg.id]: true }));
        setReportSuccessId(msg.id);
        setTimeout(() => {
          setReportSuccessId((cur) => (cur === msg.id ? null : cur));
        }, 3000);
      }
    } catch {
      // Safe catch
    } finally {
      setReportingId(null);
    }
  };

  return (
    <>
      {/* Floating Chat Trigger Button (Fixed so it never pushes or alters the game board) */}
      {!isChatOff && (
        <div className="fixed bottom-24 right-3 sm:right-6 z-40">
          <motion.button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? 'Close chat' : `Open chat (${unreadCount} unread)`}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className={`relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border shadow-xl backdrop-blur-md transition-all cursor-pointer ${
              isOpen
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                : 'bg-slate-900/90 border-white/15 text-slate-200 hover:border-cyan-400/60 hover:text-white shadow-[0_0_15px_rgba(0,0,0,0.6)]'
            }`}
          >
            <MessageSquare className="w-5 h-5 text-cyan-400" />

            {/* Unread Message Count Badge */}
            {!isOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-pink-500 text-white font-mono text-[10px] font-black shadow-[0_0_8px_#ff007f] animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>
        </div>
      )}

      {/* Button to turn chat back on if disabled */}
      {isChatOff && (
        <div className="fixed bottom-24 right-3 sm:right-6 z-40">
          <motion.button
            type="button"
            onClick={() => setIsChatOff(false)}
            aria-label="Turn on chat"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-400/40 text-xs font-bold shadow-lg backdrop-blur-md cursor-pointer transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Turn on chat</span>
          </motion.button>
        </div>
      )}

      {/* Chat Panel Overlay / Bottom Sheet (Never pushes or shrinks board) */}
      <AnimatePresence>
        {isOpen && !isChatOff && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
            />

            {/* Main Chat Panel Container */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-24 sm:right-6 w-full sm:w-88 sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#090d16]/95 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,240,255,0.2)] backdrop-blur-xl flex flex-col max-h-[75vh] sm:max-h-[480px] overflow-hidden"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                  <span className="font-mono text-xs font-black tracking-wider uppercase text-cyan-300">
                    2P Match Chat
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Mute opponent toggle */}
                  <button
                    type="button"
                    onClick={() => setIsMuted((prev) => !prev)}
                    title={isMuted ? 'Unmute opponent' : 'Mute opponent'}
                    aria-label={isMuted ? 'Unmute opponent' : 'Mute opponent'}
                    className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>

                  {/* Turn off chat switch */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsChatOff(true);
                      setIsOpen(false);
                    }}
                    title="Turn off chat"
                    aria-label="Turn off chat"
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-400/40 transition-colors cursor-pointer"
                  >
                    <MessageSquareOff size={14} />
                  </button>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat panel"
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Status Notice when Muted or Opponent Disconnected */}
              {isMuted && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-[11px] font-semibold">
                  <EyeOff size={12} className="shrink-0" />
                  <span>Opponent messages are hidden (Muted)</span>
                </div>
              )}

              {!isOpponentConnected && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-[11px] font-semibold">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{opponentName} left the chat</span>
                </div>
              )}

              {/* Message History List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px] max-h-[320px] text-xs">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-36 text-center text-slate-500 text-[11px] gap-1 select-none">
                    <MessageSquare size={22} className="opacity-40 mb-1" />
                    <span>No messages yet in this room.</span>
                    <span>Say hi to your opponent!</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.seatIndex === mySeatIndex;

                    // If opponent is muted, hide their messages
                    if (!isMe && isMuted) {
                      return null;
                    }

                    const symbolColor = SEAT_COLORS[msg.symbol]?.hex || (isMe ? '#00f0ff' : '#ff007f');
                    const isReported = Boolean(reportedMessageIds[msg.id]);
                    const showReportSuccess = reportSuccessId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}
                      >
                        {/* Sender Name and Time */}
                        <div className="flex items-center gap-1.5 px-1 font-mono text-[10px] text-slate-400">
                          <span style={{ color: symbolColor }} className="font-extrabold">
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          <span className="text-slate-600">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Plain text message bubble */}
                        <div
                          className={`relative max-w-[85%] px-3 py-2 rounded-2xl border text-xs break-words select-text ${
                            isMe
                              ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-50 rounded-br-xs shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                              : 'bg-slate-900/80 border-white/15 text-slate-100 rounded-bl-xs'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>

                        {/* Report Action for opponent messages */}
                        {!isMe && (
                          <div className="flex items-center gap-2 px-1">
                            {showReportSuccess ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                                <Check size={10} /> Thanks, reported.
                              </span>
                            ) : isReported ? (
                              <span className="text-[10px] text-slate-500 italic">Reported</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReport(msg)}
                                disabled={reportingId === msg.id}
                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Flag size={10} />
                                <span>Report</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-slate-950/80">
                <div className="relative flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, 120))}
                    disabled={disabled || !isOpponentConnected}
                    placeholder={
                      !isOpponentConnected
                        ? 'Opponent disconnected'
                        : 'Type message... (max 120)'
                    }
                    maxLength={120}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />

                  <button
                    type="submit"
                    disabled={disabled || !isOpponentConnected || !inputText.trim()}
                    aria-label="Send message"
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                  >
                    <Send size={14} />
                  </button>
                </div>

                {/* Character Counter & Safety Notice */}
                <div className="flex items-center justify-between mt-1 px-1 font-mono text-[9px] text-slate-500">
                  <span>Plain text only • Links filtered</span>
                  <span className={inputText.length >= 110 ? 'text-amber-400 font-bold' : ''}>
                    {inputText.length}/120
                  </span>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
