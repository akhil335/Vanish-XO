'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense, useMemo } from 'react';
import PartySocket from 'partysocket';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Share2, Play, Check, Users, Eye, DoorOpen, X, DoorClosed, HelpCircle, AlertTriangle, Home, Activity, RotateCcw, Bot } from 'lucide-react';
import { RoomState, ServerMessage, MarkSymbol, MatchConfig, isValidRoomCode, generateRoomCode } from '@/lib/types';
import { getRealtimeConfig, getSiteUrl } from '@/lib/config';
import { track, trackFirstMove } from '@/lib/analytics';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { GameBoard } from '@/components/GameBoard';
import { OnlinePlayerBar } from '@/components/OnlinePlayerBar';
import { GameOverBanner, GameOverControls } from '@/components/GameOverExperience';
import { ToastNotification, ToastItem } from '@/components/ToastNotification';
import { RoomDebugPanel } from '@/components/RoomDebugPanel';
import { getBoardAtMove, getMoveInsights } from '@/lib/game';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { loadProgression, saveProgression, updateStats } from '@/lib/progress';
import { BadgeToast, BadgeToastItem } from '@/components/BadgeToast';
import { useSession } from 'next-auth/react';
import { getOrCreatePlayerId, getPlayerName, generateGuestName } from '@/lib/player';

function RoomPageContent() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCode = ((params?.code as string) || '').trim().toUpperCase();

  const [roomCode, setRoomCode] = useState(rawCode);
  const [isNotFound, setIsNotFound] = useState(!isValidRoomCode(rawCode));
  const [createFailed, setCreateFailed] = useState(false);
  const [isServerBusy, setIsServerBusy] = useState(() => !getRealtimeConfig());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const createAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedRoomCreatedRef = useRef(false);
  const hasTrackedRoomJoinedRef = useRef(false);
  const hasTrackedNotFoundRef = useRef(false);
  const hasTrackedServerBusyRef = useRef(false);

  const isCreateParam = searchParams?.get('action') === 'create';
  const isCreateRef = useRef(isCreateParam);
  useEffect(() => {
    if (isCreateParam) {
      isCreateRef.current = true;
    }
  }, [isCreateParam]);
  const matchToken = searchParams?.get('token') || undefined;
  const isMatchmade = searchParams?.get('match') === 'true';
  const seatParam = searchParams?.get('seat');
  const seatsCountParam = searchParams?.get('seatsCount');
  const botsParam = searchParams?.get('bots');
  const startParam = searchParams?.get('start');

  const matchConfig: MatchConfig | undefined = useMemo(() => {
    if (!isMatchmade || !seatParam || !seatsCountParam || !startParam) return undefined;
    return {
      assignedSeatIndex: parseInt(seatParam, 10),
      seatsCount: parseInt(seatsCountParam, 10) as 2 | 3 | 4,
      startingSeatIndex: parseInt(startParam, 10),
      botSeats: botsParam
        ? botsParam
          .split(',')
          .filter(Boolean)
          .map((n) => parseInt(n, 10))
        : [],
    };
  }, [isMatchmade, seatParam, seatsCountParam, botsParam, startParam]);

  const [playerId, setPlayerId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getOrCreatePlayerId();
    }
    return '';
  });
  const [lastStateTime, setLastStateTime] = useState<number | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [highlightUnready, setHighlightUnready] = useState(false);
  const [vanishedAnim, setVanishedAnim] = useState<{
    cell: number;
    player: MarkSymbol;
    id: number;
  } | null>(null);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToastItem[]>([]);

  // Local Replay State (Multiplayer replay is strictly local)
  const [isReplay, setIsReplay] = useState(false);
  const [replayStepIndex, setReplayStepIndex] = useState(0);

  const isReplayActive = isReplay && Boolean(roomState?.winner);
  const roomHistory = roomState?.history;
  const roomConfig = roomState?.config;

  const currentReplayState = useMemo(() => {
    if (!isReplayActive || !roomHistory || roomHistory.length === 0) return null;
    return getBoardAtMove(roomHistory, replayStepIndex, roomConfig);
  }, [isReplayActive, roomHistory, replayStepIndex, roomConfig]);

  const replayInsights = useMemo(() => {
    if (!roomHistory) return [];
    return getMoveInsights(roomHistory, roomConfig);
  }, [roomHistory, roomConfig]);

  const currentReplayInsight = replayInsights[replayStepIndex];

  // Reset local replay state whenever a new round begins or status changes to playing
  useEffect(() => {
    const currentPhase = roomState?.phase ?? roomState?.status;
    if (currentPhase === 'playing') {
      const timer = setTimeout(() => {
        setIsReplay(false);
        setReplayStepIndex(0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [roomState?.phase, roomState?.status]);

  const socketRef = useRef<PartySocket | null>(null);
  const prevStateRef = useRef<RoomState | null>(null);
  const prevSeatsCountRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);

  // Initialize player ID from localStorage if not already initialized
  useEffect(() => {
    const id = getOrCreatePlayerId();
    const timer = setTimeout(() => {
      setPlayerId(id);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Sync route param changes
  useEffect(() => {
    const code = ((params?.code as string) || '').trim().toUpperCase();
    if (code && code !== roomCode) {
      const timer = setTimeout(() => {
        setRoomCode(code);
        if (!isValidRoomCode(code)) {
          setIsNotFound(true);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [params?.code, roomCode]);

  // Web Share / Copy Link
  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${getSiteUrl()}/room/${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vanish XO Online',
          text: `Join Vanish XO room ${roomCode}!`,
          url: shareUrl,
        });
        track('invite_shared', { method: 'native' });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => { });
      track('invite_shared', { method: 'clipboard' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Toast helper
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  // PartySocket Connection
  useEffect(() => {
    if (!playerId) return;

    // Malformed code check: don't connect to the server at all
    if (!isValidRoomCode(roomCode)) {
      if (!hasTrackedNotFoundRef.current) {
        hasTrackedNotFoundRef.current = true;
        track('room_not_found');
      }
      return;
    }

    const config = getRealtimeConfig();

    if (!config) {
      return;
    }

    const socket = new PartySocket({
      host: config.host,
      protocol: config.protocol,
      room: roomCode,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 10000,
      reconnectionDelayGrowFactor: 2,
      connectionTimeout: 5000,
    });

    socketRef.current = socket;

    // Start 60-second failure timer in case initial connection or reconnection completely fails
    if (!reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        socket.close();
        setIsReconnecting(false);
        setIsServerBusy(true);
      }, 60000);
    }

    socket.addEventListener('open', () => {
      setIsReconnecting(false);
      setIsServerBusy(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const currentName = getPlayerName(session?.user);
      const currentUserId = session?.user?.id || undefined;
      if (isCreateRef.current) {
        socket.send(JSON.stringify({ type: 'create', playerId, playerName: currentName, name: currentName, userId: currentUserId }));
      } else {
        socket.send(JSON.stringify({ type: 'join', playerId, playerName: currentName, name: currentName, userId: currentUserId, matchConfig, matchToken }));
      }
    });

    socket.addEventListener('close', () => {
      setIsReconnecting(true);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          socket.close();
          setIsReconnecting(false);
          setIsServerBusy(true);
        }, 60000);
      }
    });

    socket.addEventListener('error', () => {
      setIsReconnecting(true);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          socket.close();
          setIsReconnecting(false);
          setIsServerBusy(true);
        }, 60000);
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        if (msg.type === 'state') {
          setLastStateTime(Date.now());
          if (isCreateRef.current) {
            isCreateRef.current = false;
            window.history.replaceState(null, '', `/room/${roomCode}`);
          }
          const nextState = msg.state;
          const prev = prevStateRef.current;

          // Track room_created once
          if (!hasTrackedRoomCreatedRef.current && nextState.hostPlayerId === playerId) {
            hasTrackedRoomCreatedRef.current = true;
            track('room_created', { players: nextState.seatsCount });
          }

          // Track room_joined once
          if (!hasTrackedRoomJoinedRef.current) {
            hasTrackedRoomJoinedRef.current = true;
            const isLocalHost = nextState.hostPlayerId === playerId;
            const isLocalSpectator = !nextState.seats.some((s) => s.playerId === playerId);
            track('room_joined', {
              players: nextState.seatsCount,
              role: isLocalHost ? 'host' : isLocalSpectator ? 'spectator' : 'guest',
            });
          }

          // Track game_started once per game start
          if (prev && prev.status !== 'playing' && nextState.status === 'playing') {
            gameStartTimeRef.current = Date.now();
            track('game_started', {
              players: nextState.seatsCount,
              bots: nextState.seats.filter((s) => s.isBot).length,
              mode: isMatchmade ? 'matchmaking' : 'private',
            });
          }

          // Detect audio / haptic triggers from state transitions
          if (prev) {
            // Placement sound
            if (nextState.status === 'playing' && prev.status === 'playing') {
              const prevTurn = prev.turnSeatIndex;
              const prevSymbol = prev.seats[prevTurn]?.symbol;
              if (prevSymbol) {
                soundManager.playPlace(prevSymbol === 'X' ? 'X' : 'O');
              }
            }

            // Vanish sound & particle
            if (nextState.lastVanished && (!prev.lastVanished || prev.lastVanished.cell !== nextState.lastVanished.cell || prev.lastVanished.symbol !== nextState.lastVanished.symbol)) {
              soundManager.playVanish();
              triggerHaptic('vanish');
              setVanishedAnim({
                cell: nextState.lastVanished.cell,
                player: nextState.lastVanished.symbol,
                id: Date.now(),
              });
            }

          }

          // Track game_finished once when winner appears
          if (nextState.winner && !prev?.winner) {
            const totalTurns = Object.values(nextState.playerMoves).reduce((acc, m) => acc + m.length, 0);
            const startTimestamp = gameStartTimeRef.current || (nextState.turnStartedAt ? nextState.turnStartedAt : null);
            let durationSeconds: number | undefined;
            if (startTimestamp) {
              const diff = Math.round((Date.now() - startTimestamp) / 1000);
              if (!isNaN(diff) && diff >= 0) {
                durationSeconds = diff;
              }
            }
            track('game_finished', {
              players: nextState.seatsCount,
              bots: nextState.seats.filter((s) => s.isBot).length,
              turns: totalTurns,
              mode: isMatchmade ? 'matchmaking' : 'private',
              ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
            });

            // Local Progression Update (stats & badges)
            const activePlayerId = playerId || (typeof window !== 'undefined' ? getOrCreatePlayerId() : '');
            const userSeat = nextState.seats.find((s) => s.playerId === activePlayerId);
            if (userSeat) {
              const won = nextState.winner === userSeat.symbol;
              const modeKey = nextState.seatsCount === 3 ? '3P' : nextState.seatsCount === 4 ? '4P' : '2P';
              const hasHumanOpponent = nextState.seats.some((s) => s.seatIndex !== userSeat.seatIndex && !s.isBot);
              const oppType = hasHumanOpponent ? 'human' : 'Medium';

              const currentProgression = loadProgression();
              const updateRes = updateStats(currentProgression, {
                mode: modeKey,
                opponent: oppType,
                won,
                turns: totalTurns,
                history: nextState.history,
                playerSymbol: userSeat.symbol,
                config: nextState.config,
              });
              saveProgression(updateRes.nextData);

              for (const badgeId of updateRes.newBadges) {
                track('badge_unlocked', { id: badgeId });
                setBadgeToasts((t) => [...t, { id: `${badgeId}-${Date.now()}`, badgeId }]);
              }
              if (updateRes.rankUpTier) {
                track('rank_up', { tier: updateRes.rankUpTier.toLowerCase() });
              }
              if (updateRes.newStreakReached) {
                track('streak_reached', { n: updateRes.newStreakReached });
              }
            }

            // Record ranked result for online room game
            fetch('/api/leaderboard/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomCode,
                roomState: nextState,
                callerPlayerId: activePlayerId,
              }),
            })
              .then((res) => res.json() as Promise<{ rated?: boolean; alreadyRecorded?: boolean; winner?: { name?: string; delta?: number }; message?: string }>)
              .then((data) => {
                if (data.rated && !data.alreadyRecorded) {
                  addToast({
                    type: 'message',
                    message: `Ranked result recorded! ${data.winner?.name || 'Winner'} won (+${data.winner?.delta ?? 0})`,
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('vanish_xo_leaderboard_updated'));
                  }
                } else if (!data.rated && data.message && session?.user?.id) {
                  addToast({
                    type: 'message',
                    message: data.message,
                  });
                }
              })
              .catch((err) => {
                console.error('[room:record] Failed to record ranked match result:', err);
                if (session?.user?.id) {
                  addToast({
                    type: 'message',
                    message: 'Unable to record ranked result.',
                  });
                }
              });
          }

          if (nextState.rematchDeclined && !prev?.rematchDeclined) {
            addToast({ type: 'message', message: 'Rematch declined or timed out' });
          }

          prevStateRef.current = nextState;
          setRoomState(nextState);
        } else if (msg.type === 'player_joined') {
          addToast({ type: 'player_joined', seatIndex: msg.seatIndex, isBot: msg.isBot });
        } else if (msg.type === 'player_left') {
          addToast({ type: 'player_left', seatIndex: msg.seatIndex });
        } else if (msg.type === 'host_changed') {
          addToast({ type: 'host_changed', seatIndex: msg.seatIndex, newHostPlayerId: msg.newHostPlayerId });
        } else if (msg.type === 'error') {
          if (msg.code === 'REMATCH_TIMEOUT') {
            addToast({ type: 'message', message: 'Rematch request timed out' });
            return;
          }
          if (msg.code === 'OPPONENT_NOT_AVAILABLE') {
            addToast({ type: 'message', message: msg.message || 'Opponent is not available for a rematch' });
            return;
          }
          if (msg.code === 'ROOM_NOT_FOUND') {
            if (!hasTrackedNotFoundRef.current) {
              hasTrackedNotFoundRef.current = true;
              track('room_not_found');
            }
            setIsNotFound(true);
            socket.close();
            return;
          }
          if (msg.code === 'ROOM_TAKEN' && isCreateRef.current) {
            createAttemptsRef.current += 1;
            if (createAttemptsRef.current < 5) {
              const nextCode = generateRoomCode();
              setRoomCode(nextCode);
              window.history.replaceState(null, '', `/room/${nextCode}?action=create`);
            } else {
              setCreateFailed(true);
              socket.close();
            }
            return;
          }
          if (msg.code === 'SERVER_BUSY' || msg.code === 'RATE_LIMIT' || msg.code === 'QUOTA_EXCEEDED') {
            setIsServerBusy(true);
            socket.close();
            return;
          }
          if (msg.code === 'NOT_ALL_READY' || msg.code === 'UNFILLED_SEATS' || msg.code === 'SEATS_NOT_FILLED' || msg.code === 'CANNOT_START') {
            setIsShaking(true);
            setHighlightUnready(true);
            soundManager.playPlace('O');
            triggerHaptic('vanish');
            setTimeout(() => setIsShaking(false), 500);
            setTimeout(() => setHighlightUnready(false), 1500);
          }
        }
      } catch {
        // Safe catch
      }
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      socket.close();
      socketRef.current = null;
    };
  }, [playerId, roomCode, matchConfig, matchToken, addToast, isMatchmade, retryKey, session?.user]);

  // Detect seat count changes in lobby and display toast
  useEffect(() => {
    if (!roomState) return;
    if (prevSeatsCountRef.current !== null && prevSeatsCountRef.current !== roomState.seatsCount) {
      if (roomState.status === 'waiting') {
        const count = roomState.seatsCount;
        const timer = setTimeout(() => {
          addToast({ type: 'seats_changed', seatsCount: count });
          soundManager.playPlace('X');
        }, 0);
        prevSeatsCountRef.current = roomState.seatsCount;
        return () => clearTimeout(timer);
      }
    }
    prevSeatsCountRef.current = roomState.seatsCount;
  }, [roomState, addToast]);

  // Client heartbeat every 25 seconds, paused when tab is hidden
  useEffect(() => {
    const sendHeartbeat = () => {
      if (
        document.visibilityState === 'visible' &&
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    const interval = setInterval(sendHeartbeat, 3000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Clean Leave Room
  const handleLeaveRoom = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'leave' }));
        socketRef.current.close();
      } catch { }
      socketRef.current = null;
    }
    try {
      sessionStorage.removeItem('vanish_xo_room');
      localStorage.removeItem('vanish_xo_room');
    } catch { }
    router.push('/');
  }, [router]);

  // Register room session with Next.js server for server-side verification
  useEffect(() => {
    if (!roomCode || !playerId) return;
    const seatIdx = roomState?.seats.findIndex((s) => s.playerId === playerId);
    const resolvedSeatIndex = seatIdx !== undefined && seatIdx >= 0 ? seatIdx : 0;

    fetch('/api/room/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        seatIndex: resolvedSeatIndex,
        playerId,
      }),
    }).catch((err) => console.error('[room:session] Failed to register session:', err));
  }, [roomCode, playerId, session?.user?.id, roomState?.seats]);

  // Keep player identity / name synced if session loads after socket opens
  useEffect(() => {
    if (!socketRef.current || !playerId) return;
    const currentName = getPlayerName(session?.user);
    const currentUserId = session?.user?.id || undefined;
    if (socketRef.current.readyState === 1) {
      socketRef.current.send(
        JSON.stringify({
          type: 'join',
          playerId,
          playerName: currentName,
          name: currentName,
          userId: currentUserId,
        })
      );
    }
  }, [session?.user, playerId]);

  const handleBackClick = () => {
    const activePhase = roomState?.phase ?? roomState?.status;
    if (activePhase === 'playing') {
      track('home_clicked', { from: 'ingame' });
      setShowLeaveConfirm(true);
    } else {
      track('home_clicked', { from: 'lobby' });
      handleLeaveRoom();
    }
  };

  // Derived Player Info & Host Detection strictly from state.hostPlayerId === myPlayerId
  const myPlayerId = playerId || (typeof window !== 'undefined' ? getOrCreatePlayerId() : '');
  const mySeat = roomState?.seats.find((s) => s.playerId === myPlayerId);
  const mySeatIndex = mySeat !== undefined ? mySeat.seatIndex : null;
  const isSpectator = mySeatIndex === null;
  const isHost = Boolean(roomState && myPlayerId && roomState.hostPlayerId === myPlayerId);
  const roomPhase = roomState ? (roomState.phase ?? roomState.status) : 'uninitialized';
  const isMyTurn = roomPhase === 'playing' && roomState?.turnSeatIndex === mySeatIndex;

  const opponentSeat = roomState?.seats.find((s) => s.seatIndex !== mySeatIndex && (s.playerId !== null || s.isBot));
  const rawOpponentName = opponentSeat?.playerName || opponentSeat?.name;
  const opponentName = opponentSeat?.isBot
    ? 'Bot'
    : (rawOpponentName && rawOpponentName.trim() && rawOpponentName.trim() !== 'Player')
    ? rawOpponentName.trim()
    : (opponentSeat?.playerId && opponentSeat.playerId.startsWith('p_') ? generateGuestName(opponentSeat.playerId) : (rawOpponentName || 'Opponent'));
  const isOpponentDisconnected = Boolean(opponentSeat && (opponentSeat.isConnected === false || opponentSeat.connected === false));
  const isOpponentGone = Boolean(!opponentSeat || opponentSeat.playerId === null || isOpponentDisconnected);

  const isInputLockedRef = useRef(false);

  // Actions
  const handleCellClick = (cellIndex: number) => {
    if (!socketRef.current || !isMyTurn || isInputLockedRef.current) return;
    trackFirstMove(isMatchmade ? 'matchmaking' : 'private');
    isInputLockedRef.current = true;
    socketRef.current.send(JSON.stringify({ type: 'place', cell: cellIndex }));
    setTimeout(() => {
      isInputLockedRef.current = false;
    }, 300);
  };

  const handleSetSeats = (seatsCount: 2 | 3 | 4) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'set_seats', seatsCount }));
  };

  const handleToggleBot = (seatIndex: number, currentIsBot: boolean) => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'set_bot_seat', seatIndex, isBot: !currentIsBot }));
  };

  const handleToggleReady = (ready: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'ready', ready }));
  };

  const handleStartGame = () => {
    if (!socketRef.current || !isHost) return;
    socketRef.current.send(JSON.stringify({ type: 'start' }));
  };

  const handleRematch = () => {
    track('rematch_clicked', { mode: isMatchmade ? 'matchmaking' : 'private' });
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'rematch_request' }));
    addToast({ type: 'message', message: 'Rematch requested! Waiting for opponent...' });
  };

  const handleRematchAccept = () => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'rematch_accept' }));
  };

  const handleRematchDecline = () => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'rematch_decline' }));
  };

  const handleRetry = useCallback(() => {
    setIsServerBusy(false);
    setIsReconnecting(true);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setRetryKey((k) => k + 1);
  }, []);

  const handlePlayVsBot = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    router.push('/?mode=bot');
  }, [router]);

  // Track server_busy_shown once per occurrence
  useEffect(() => {
    if (isServerBusy && !hasTrackedServerBusyRef.current) {
      hasTrackedServerBusyRef.current = true;
      track('server_busy_shown');
    } else if (!isServerBusy) {
      hasTrackedServerBusyRef.current = false;
    }
  }, [isServerBusy]);

  if (isServerBusy) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#06080d] text-white select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-w-[280px] w-full bg-[#0a0d16]/95 border border-amber-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl backdrop-blur-md"
        >
          {/* Server busy icon: Activity */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <Activity size={36} />
          </div>

          <span className="font-black text-xs tracking-widest uppercase text-amber-300/90">SERVER BUSY</span>

          <div className="w-full flex flex-col gap-2.5">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRetry}
              className="w-full py-3 rounded-2xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:bg-cyan-300 transition-all"
              aria-label="Retry"
            >
              <RotateCcw size={16} />
              <span>RETRY</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePlayVsBot}
              className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-pink-500 hover:text-pink-300 transition-all"
              aria-label="Play vs Bot"
            >
              <Bot size={16} />
              <span>PLAY VS BOT</span>
            </motion.button>
          </div>
        </motion.div>
      </main>
    );
  }

  if (isNotFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#06080d] text-white select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-w-[280px] w-full bg-[#0a0d16]/90 border border-amber-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl backdrop-blur-md"
        >
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

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-cyan-400 hover:text-cyan-300 transition-all"
            aria-label="Home"
          >
            <Home size={16} />
            <span>HOME</span>
          </motion.button>
        </motion.div>
      </main>
    );
  }

  if (createFailed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#06080d] text-white select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative max-w-[280px] w-full bg-[#0a0d16]/90 border border-rose-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.25)]">
            <AlertTriangle size={36} />
          </div>

          <span className="font-black text-xs tracking-widest uppercase text-rose-300/80">ERROR</span>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-rose-400 hover:text-rose-300 transition-all"
            aria-label="Home"
          >
            <Home size={16} />
            <span>HOME</span>
          </motion.button>
        </motion.div>
      </main>
    );
  }

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06080d] text-cyan-400 select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            {isReconnecting && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-red-500 animate-ping" />
            )}
          </div>
          <span className="font-mono text-xs tracking-widest uppercase">
            {isReconnecting ? 'RECONNECTING...' : 'CONNECTING...'}
          </span>
        </div>
      </div>
    );
  }

  const effectiveRoomState = isReconnecting
    ? {
      ...roomState,
      seats: roomState.seats.map((seat) =>
        seat.playerId === playerId ? { ...seat, isConnected: false, connected: false } : seat
      ),
    }
    : roomState;

  const blockReasons = roomState.blockReasons ?? [];
  const totalSeats = roomState.seatCount ?? roomState.seatsCount ?? 2;
  const humanOrBotSeats = roomState.seats.slice(0, totalSeats);
  const filledSeats = humanOrBotSeats.filter((s) => s.isBot || s.kind === 'bot' || s.playerId !== null).length;
  const readyCount = roomState.readyCount ?? humanOrBotSeats.filter((s) => s.isBot || s.kind === 'bot' || (s.playerId && (s.ready || s.isReady) && s.connected !== false && s.isConnected !== false)).length;
  const allSeatsFilled = filledSeats >= totalSeats;
  const allSeatsReady = totalSeats >= 2 && allSeatsFilled && readyCount >= totalSeats;
  const canStart = Boolean(roomState.canStart !== undefined ? (roomState.canStart || allSeatsReady) : allSeatsReady);
  const contentWidth = effectiveRoomState.seatsCount === 4 ? 'max-w-[440px]' : effectiveRoomState.seatsCount === 3 ? 'max-w-[400px]' : 'max-w-[360px]';

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-between px-3 py-4 select-none overflow-x-hidden">
      {/* Toast notifications */}
      <ToastNotification toasts={toasts} />

      {/* Main Room Container */}
      <div className={`w-full ${contentWidth} flex flex-col items-center gap-3 my-auto transition-all duration-300`}>
        {/* Header Bar */}
        <div className="w-full flex items-center justify-between px-1">
          <button
            type="button"
            id="back-home-btn"
            onClick={handleBackClick}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-xl border border-white/10 font-mono">
            <span className="text-xs text-slate-400">ROOM</span>
            <span className="text-sm font-black text-cyan-400 tracking-wider">{roomCode}</span>
            {isReconnecting && (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 animate-ping opacity-85 ml-0.5" title="Reconnecting" />
            )}
          </div>

          {/* Invite / Share button */}
          <div className="relative">
            <button
              type="button"
              id="invite-room-btn"
              onClick={handleShare}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
            </button>
            {copied && (
              <span className="absolute -top-7 right-0 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-black shadow-md tracking-wider uppercase pointer-events-none">
                COPIED
              </span>
            )}
          </div>
        </div>

        {/* Spectator Warning Banner */}
        {isSpectator && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
            <Eye size={14} />
            <span>SPECTATING</span>
          </div>
        )}

        {/* Online Player Bar & Turn Countdown */}
        <div className="w-full">
          <OnlinePlayerBar
            roomState={effectiveRoomState}
            mySeatIndex={mySeatIndex}
            isHost={isHost}
            myPlayerName={getPlayerName(session?.user)}
            highlightUnready={highlightUnready}
            blockReasons={blockReasons}
            onToggleBot={handleToggleBot}
            onToggleReady={handleToggleReady}
            onShare={handleShare}
          />
        </div>

        {/* Lobby Waiting Controls for Host (Private rooms only) */}
        {roomPhase === 'waiting' && isHost && !isMatchmade && (
          <div className="w-full flex items-center justify-between gap-2 p-2 bg-slate-900/80 rounded-2xl border border-white/10 backdrop-blur-md">
            {/* Seats count toggle: 2, 3, 4 */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
              <Users size={14} className="text-slate-400 ml-1 mr-0.5" />
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  id={`seats-count-${count}`}
                  onClick={() => handleSetSeats(count)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${roomState.seatsCount === count
                    ? 'bg-cyan-400 text-black font-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* Start Button */}
            <motion.button
              type="button"
              id="start-game-btn"
              animate={isShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              onClick={() => {
                if (!canStart) {
                  setIsShaking(true);
                  setHighlightUnready(true);
                  soundManager.playPlace('O');
                  triggerHaptic('vanish');
                  setTimeout(() => setIsShaking(false), 500);
                  setTimeout(() => setHighlightUnready(false), 1500);
                  return;
                }
                handleStartGame();
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer ${canStart
                ? 'bg-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.6)] animate-pulse hover:bg-emerald-300 active:scale-95'
                : 'bg-slate-800 text-slate-400 border border-white/5 hover:border-white/15 active:scale-95'
                }`}
            >
              {canStart ? (
                <div className="flex items-center gap-1.5">
                  <Play size={14} fill="currentColor" />
                  <span>START</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold text-slate-300">
                    <Play size={10} fill="currentColor" className="text-slate-500" />
                    <span>START {readyCount}/{totalSeats}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {roomState.seats.map((seat) => {
                      const isSeatReady = seat.kind === 'bot' || seat.isBot || (seat.playerId && (seat.ready || seat.isReady) && seat.connected !== false && seat.isConnected !== false);
                      return (
                        <span
                          key={seat.seatIndex}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${isSeatReady ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-slate-600'
                            }`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.button>
          </div>
        )}

        {/* Guest Ready Button at bottom of screen */}
        {roomPhase === 'waiting' && !isHost && !isSpectator && !isMatchmade && (
          <div className="w-full">
            {!(mySeat?.ready ?? mySeat?.isReady) ? (
              <motion.button
                type="button"
                id="guest-ready-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleToggleReady(true)}
                className="w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider bg-emerald-500 text-black shadow-[0_0_25px_rgba(52,211,153,0.5)] animate-pulse flex items-center justify-center gap-2 hover:bg-emerald-400 cursor-pointer transition-all"
              >
                <Check size={18} strokeWidth={3} />
                <span>READY</span>
              </motion.button>
            ) : (
              <motion.button
                type="button"
                id="guest-unready-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleToggleReady(false)}
                className="w-full py-3 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider bg-slate-900 border border-emerald-400/50 text-emerald-400 shadow-lg flex items-center justify-center gap-2 hover:border-emerald-300 cursor-pointer transition-all"
              >
                <Check size={15} strokeWidth={3} />
                <span>WAITING</span>
                <span className="flex items-center gap-1 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </motion.button>
            )}
          </div>
        )}

        {/* Lobby Waiting Indicator for Matchmade games */}
        {roomPhase === 'waiting' && isMatchmade && (
          <div className="w-full flex items-center justify-center gap-2 p-3 bg-slate-900/80 rounded-2xl border border-cyan-500/30 backdrop-blur-md">
            <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs tracking-wider text-cyan-400 font-bold">STARTING MATCH...</span>
          </div>
        )}

        {/* Opponent Disconnect / Pause Notice */}
        {roomPhase === 'playing' && effectiveRoomState?.paused && (
          <div className="w-full flex items-center justify-center gap-2 p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse backdrop-blur-md shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>
              {effectiveRoomState.pausedReason === 'opponent_left'
                ? `${opponentName} left`
                : 'Waiting for opponent to reconnect...'}
            </span>
          </div>
        )}

        {/* Game Abandoned Notice */}
        {roomPhase === 'finished' && effectiveRoomState?.pausedReason === 'opponent_abandoned' && (
          <div className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <span>{opponentName} left the game</span>
          </div>
        )}

        {/* Game Over Banner (ABOVE the board, never covering it) */}
        {effectiveRoomState?.winner && (
          <GameOverBanner
            winner={effectiveRoomState.winner}
            outcome={
              isSpectator
                ? 'spectator'
                : mySeat?.symbol === effectiveRoomState.winner
                ? 'win'
                : 'lose'
            }
            mySymbol={mySeat?.symbol}
            winnerName={
              mySeat?.symbol === effectiveRoomState.winner
                ? getPlayerName(session?.user)
                : (() => {
                    const winningSeat = effectiveRoomState.seats.find((s) => s.symbol === effectiveRoomState.winner);
                    const rawName = winningSeat?.playerName || winningSeat?.name;
                    return winningSeat?.isBot
                      ? 'Bot'
                      : (rawName && rawName.trim() && rawName.trim() !== 'Player')
                      ? rawName.trim()
                      : (winningSeat?.playerId && winningSeat.playerId.startsWith('p_') ? generateGuestName(winningSeat.playerId) : (rawName || 'Player'));
                  })()
            }
            isReplay={isReplayActive}
            replayMove={currentReplayState?.lastMove}
            replayStepIndex={replayStepIndex}
            totalReplaySteps={effectiveRoomState.history?.length || 0}
            isReplayTrap={currentReplayInsight?.hasWarning}
            hadVanish={Boolean(effectiveRoomState.lastVanished)}
          />
        )}

        {/* Interactive Board at full size */}
        <GameBoard
          roomState={effectiveRoomState}
          onCellClick={handleCellClick}
          disabled={!isMyTurn || roomPhase !== 'playing' || isReplayActive || Boolean(effectiveRoomState?.paused)}
          vanishedAnim={vanishedAnim}
          onVanishedAnimComplete={() => setVanishedAnim(null)}
          boardOverride={isReplayActive && currentReplayState ? currentReplayState.board : undefined}
          winningLineOverride={isReplayActive && currentReplayState ? currentReplayState.winningLine : undefined}
          winnerOverride={isReplayActive && currentReplayState ? currentReplayState.winner : undefined}
          lastMoveCell={
            isReplayActive && currentReplayState
              ? currentReplayState.lastMove.cell
              : effectiveRoomState?.lastMoveCell
          }
          ghostVanish={
            isReplayActive && currentReplayState
              ? currentReplayState.lastMove.vanished
              : effectiveRoomState?.lastVanished
          }
          isReplay={isReplayActive}
          isGameOver={Boolean(effectiveRoomState?.winner)}
        />

        {/* Game Over Controls (BELOW the board: Again, Replay, Home OR step controls) */}
        {effectiveRoomState?.winner && (
          <GameOverControls
            winner={effectiveRoomState.winner}
            outcome={
              isSpectator
                ? 'spectator'
                : mySeat?.symbol === effectiveRoomState.winner
                ? 'win'
                : 'lose'
            }
            history={effectiveRoomState.history || []}
            isReplay={isReplayActive}
            replayStepIndex={replayStepIndex}
            onPlayAgain={handleRematch}
            onNewMatch={
              isMatchmade
                ? () =>
                    router.push(
                      effectiveRoomState?.seatsCount
                        ? `/?match=${effectiveRoomState.seatsCount}`
                        : '/?match=true'
                    )
                : undefined
            }
            onHome={() => {
              track('home_clicked', { from: 'gameover' });
              handleLeaveRoom();
            }}
            isRematchWaiting={Boolean(
              effectiveRoomState.rematchRequest &&
              effectiveRoomState.rematchRequest.requestedBy === myPlayerId
            )}
            rematchPrompt={
              effectiveRoomState.rematchRequest &&
              effectiveRoomState.rematchRequest.requestedBy !== myPlayerId
                ? {
                    requesterName: effectiveRoomState.rematchRequest.requesterName || opponentName || 'Opponent',
                    onAccept: handleRematchAccept,
                    onDecline: handleRematchDecline,
                  }
                : null
            }
            isOpponentGone={isOpponentGone}
            onShare={handleShare}
            onOpenReplay={() => {
              setIsReplay(true);
              setReplayStepIndex(Math.max(0, (effectiveRoomState.history?.length || 1) - 1));
            }}
            onCloseReplay={() => {
              setIsReplay(false);
            }}
            onStepChange={(newStep) => {
              setReplayStepIndex(newStep);
            }}
          />
        )}
      </div>

      {/* Mid-Game Leave Confirmation Dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-[240px] w-full bg-[#0a0d16] border border-rose-500/40 rounded-3xl p-6 flex flex-col items-center gap-5 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                <DoorOpen size={24} />
              </div>

              <div className="flex items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  id="confirm-leave-btn"
                  onClick={handleLeaveRoom}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/60 text-rose-400 hover:bg-rose-500 hover:text-black flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
                  aria-label="Confirm Leave"
                >
                  <Check size={20} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  id="cancel-leave-btn"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
                  aria-label="Cancel"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Badge Unlock Toasts */}
      <BadgeToast
        toasts={badgeToasts}
        onDismiss={(id) => setBadgeToasts((prev) => prev.filter((t) => t.id !== id))}
      />
      {/* Room Debug Panel (visible in development or with ?debug=1) */}
      <RoomDebugPanel roomState={roomState} myPlayerId={myPlayerId} isHost={isHost} lastStateTime={lastStateTime} />
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#06080d] text-cyan-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs tracking-widest uppercase">LOADING ROOM...</span>
          </div>
        </div>
      }
    >
      <RoomPageContent />
    </Suspense>
  );
}
