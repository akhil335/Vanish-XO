'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import {
  GameState,
  createInitialState,
  placeMark,
  getBotMove,
  Player,
  getBoardAtMove,
  getMoveInsights,
} from '@/lib/game';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PartySocket from 'partysocket';
import { getOrCreatePlayerId, getPlayerName } from '@/lib/player';
import { getRealtimeConfig } from '@/lib/config';
import { track, trackFirstMove } from '@/lib/analytics';
import { LobbyServerMessage, MarkSymbol, LiveReaction } from '@/lib/types';
import { GameBoard } from '@/components/GameBoard';
import { TopControls } from '@/components/TopControls';
import { GameOverBanner, GameOverControls } from '@/components/GameOverExperience';
import { MatchChat } from '@/components/MatchChat';
import { FirstTimeHint, isTutorialCompleted, markTutorialCompleted } from '@/components/FirstTimeHint';
import { SeoSection } from '@/components/SeoSection';
import { MatchmakingModal, MatchFoundData } from '@/components/MatchmakingModal';
import { Users, Share2, Activity, RotateCcw, Bot, Award, Trophy } from 'lucide-react';
import { generateRoomCode } from '@/lib/types';
import {
  loadProgression,
  saveProgression,
  updateStats,
  getRank,
  checkNoVanishLoss,
  normalizeOpponentType,
  createInitialProgression,
  ProgressionData,
} from '@/lib/progress';
import { ProfileModal } from '@/components/ProfileModal';
import { RankDeltaIndicator } from '@/components/RankDeltaIndicator';
import { BadgeToast, BadgeToastItem } from '@/components/BadgeToast';
import { HomeLeaderboard } from '@/components/HomeLeaderboard';
import { AdsterraBanner } from '@/components/AdsterraBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { AuthButton } from '@/components/AuthButton';
import { useSession } from 'next-auth/react';

function HomeContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [joinInput, setJoinInput] = useState('');
  const [gameState, setGameState] = useState<GameState>(() => createInitialState('X'));
  const [mode, setMode] = useState<'bot' | 'pvp'>(() => searchParams?.get('mode') === 'pvp' ? 'pvp' : 'bot');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [score, setScore] = useState<{ X: number; O: number }>({ X: 0, O: 0 });
  const [streak, setStreak] = useState<number>(0);
  const [lastWinner, setLastWinner] = useState<Player | null>(null);

  // Progression & Stats State
  const [progression, setProgression] = useState<ProgressionData>(() =>
    typeof window !== 'undefined' ? loadProgression() : createInitialProgression()
  );
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [lastRankDelta, setLastRankDelta] = useState<number | null>(null);
  const [badgeToasts, setBadgeToasts] = useState<BadgeToastItem[]>([]);

  // First-Time Tutorial State
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialStartTimeRef = useRef<number | null>(null);
  const gameStartTimeRef = useRef<number | null>(null);

  // Check first-time player on mount (bot mode on Easy for first game)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const done = isTutorialCompleted();
        if (!done) {
          setMode('bot');
          setBotDifficulty('easy');
          setIsTutorialOpen(true);
          setTutorialStep(0);
          tutorialStartTimeRef.current = Date.now();
        }
      } catch {
        // Storage access fallback
      }
      setSoundEnabled(soundManager.isEnabled());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleTutorialSkip = useCallback(() => {
    try {
      if (tutorialStartTimeRef.current) {
        const spent = Math.round((Date.now() - tutorialStartTimeRef.current) / 1000);
        if (!isNaN(spent) && spent >= 0) {
          track('tutorial_skipped', { seconds_spent: spent });
        }
        tutorialStartTimeRef.current = null;
      }
    } catch { }
    markTutorialCompleted();
    setIsTutorialOpen(false);
  }, []);

  const handleTutorialNext = useCallback(() => {
    setTutorialStep((prev) => {
      if (prev >= 4) {
        try {
          if (tutorialStartTimeRef.current) {
            const spent = Math.round((Date.now() - tutorialStartTimeRef.current) / 1000);
            if (!isNaN(spent) && spent >= 0) {
              track('tutorial_completed', { seconds_spent: spent });
            }
            tutorialStartTimeRef.current = null;
          }
        } catch { }
        markTutorialCompleted();
        setIsTutorialOpen(false);
        return prev;
      }
      return prev + 1;
    });
  }, []);

  const handleOpenTutorial = useCallback(() => {
    setTutorialStep(0);
    setIsTutorialOpen(true);
    tutorialStartTimeRef.current = Date.now();
  }, []);

  const currentRankInfo = useMemo(() => getRank(progression.rankPoints), [progression.rankPoints]);

  const [vanishedAnim, setVanishedAnim] = useState<{
    cell: number;
    player: Player;
    id: number;
  } | null>(null);

  const [liveReactions, setLiveReactions] = useState<LiveReaction[]>([]);
  const botTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Matchmaking State
  const [isSearching, setIsSearching] = useState(false);
  const [searchTargetCount, setSearchTargetCount] = useState<2 | 3 | 4>(2);
  const [currentQueueCount, setCurrentQueueCount] = useState(1);
  const [totalSearching, setTotalSearching] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchFoundData | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const lobbySocketRef = useRef<PartySocket | null>(null);
  const lobbyReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTrackedOfflineGameStartedRef = useRef(false);
  const hasTrackedServerBusyRef = useRef(false);

  // Track server_busy_shown once per occurrence
  useEffect(() => {
    if (serverBusy && !hasTrackedServerBusyRef.current) {
      hasTrackedServerBusyRef.current = true;
      track('server_busy_shown');
    } else if (!serverBusy) {
      hasTrackedServerBusyRef.current = false;
    }
  }, [serverBusy]);

  // Connect to lobby party ONLY while actively searching
  useEffect(() => {
    if (!isSearching) {
      if (lobbySocketRef.current) {
        lobbySocketRef.current.close();
        lobbySocketRef.current = null;
      }
      return;
    }

    const config = getRealtimeConfig();
    if (!config) {
      return;
    }

    const playerId = getOrCreatePlayerId();

    const socket = new PartySocket({
      host: config.host,
      protocol: config.protocol,
      party: 'lobby',
      room: 'matchmaking',
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 10000,
      reconnectionDelayGrowFactor: 2,
      connectionTimeout: 5000,
    });
    lobbySocketRef.current = socket;

    socket.addEventListener('open', () => {
      setServerBusy(false);
      if (lobbyReconnectTimeoutRef.current) {
        clearTimeout(lobbyReconnectTimeoutRef.current);
        lobbyReconnectTimeoutRef.current = null;
      }
      socket.send(
        JSON.stringify({
          type: 'queue_join',
          playerId,
          targetCount: searchTargetCount,
        })
      );
    });

    socket.addEventListener('close', () => {
      if (isSearching && !lobbyReconnectTimeoutRef.current) {
        lobbyReconnectTimeoutRef.current = setTimeout(() => {
          setServerBusy(true);
          setIsSearching(false);
        }, 60000);
      }
    });

    socket.addEventListener('error', () => {
      if (isSearching && !lobbyReconnectTimeoutRef.current) {
        lobbyReconnectTimeoutRef.current = setTimeout(() => {
          setServerBusy(true);
          setIsSearching(false);
        }, 60000);
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg: LobbyServerMessage = JSON.parse(event.data);
        if (msg.type === 'error' && (msg.code === 'SERVER_BUSY' || msg.code === 'RATE_LIMIT' || msg.code === 'QUOTA_EXCEEDED')) {
          setServerBusy(true);
          setIsSearching(false);
          socket.close();
          return;
        }
        if (msg.type === 'queue_status') {
          setTotalSearching(msg.totalSearching);
          if (msg.myQueue) {
            setCurrentQueueCount(msg.myQueue.currentCount);
          }
        } else if (msg.type === 'match_found') {
          if (msg.botSeats && msg.botSeats.length > 0) {
            track('matchmaking_filled_with_bots', {
              players: msg.seatsCount,
              humans: msg.seatsCount - msg.botSeats.length,
            });
          }
          setMatchResult({
            roomCode: msg.roomCode,
            token: msg.token || msg.matchToken,
            seatIndex: msg.seatIndex,
            seatsCount: msg.seatsCount,
            startingSeatIndex: msg.startingSeatIndex,
            botSeats: msg.botSeats,
          });
          soundManager.playPlace('X');
          // Match found: close lobby socket
          socket.close();
          lobbySocketRef.current = null;
        } else if (msg.type === 'server_busy') {
          setServerBusy(true);
        }
      } catch {
        // Safe catch
      }
    });

    return () => {
      if (lobbyReconnectTimeoutRef.current) {
        clearTimeout(lobbyReconnectTimeoutRef.current);
        lobbyReconnectTimeoutRef.current = null;
      }
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'queue_leave', playerId }));
        } catch {
          // Safe catch
        }
      }
      socket.close();
      lobbySocketRef.current = null;
    };
  }, [isSearching, searchTargetCount]);

  // Handle start matchmaking
  const handleStartSearch = useCallback((targetCount: 2 | 3 | 4) => {
    setIsTutorialOpen(false);
    if (!getRealtimeConfig()) {
      setServerBusy(true);
      return;
    }
    setServerBusy(false);
    track('matchmaking_started', { players: targetCount });
    setSearchTargetCount(targetCount);
    setCurrentQueueCount(1);
    setMatchResult(null);
    setIsSearching(true);
  }, []);

  // Handle cancel matchmaking
  const handleCancelSearch = () => {
    track('matchmaking_cancelled', { players: searchTargetCount });
    const playerId = getOrCreatePlayerId();
    if (lobbySocketRef.current && lobbySocketRef.current.readyState === WebSocket.OPEN) {
      try {
        lobbySocketRef.current.send(
          JSON.stringify({
            type: 'queue_leave',
            playerId,
          })
        );
      } catch {
        // Safe catch
      }
    }
    if (lobbySocketRef.current) {
      lobbySocketRef.current.close();
      lobbySocketRef.current = null;
    }
    setIsSearching(false);
    setMatchResult(null);
  };

  // Auto-start matchmaking when returning from a room via "New match"
  useEffect(() => {
    const matchParam = searchParams?.get('match');
    if (matchParam && !isSearching && !matchResult) {
      const count = (matchParam === '3' ? 3 : matchParam === '4' ? 4 : 2) as 2 | 3 | 4;
      const timer = setTimeout(() => {
        handleStartSearch(count);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isSearching, matchResult, handleStartSearch]);

  // When countdown completes, navigate automatically to the matchmade room
  const handleCountdownComplete = useCallback(() => {
    if (!matchResult) return;
    setIsSearching(false);
    const query = new URLSearchParams({
      match: 'true',
      seat: String(matchResult.seatIndex),
      seatsCount: String(matchResult.seatsCount),
      bots: matchResult.botSeats.join(','),
      start: String(matchResult.startingSeatIndex),
    });
    if (matchResult.token) {
      query.set('token', matchResult.token);
    }
    router.push(`/room/${matchResult.roomCode}?${query.toString()}`);
  }, [matchResult, router]);

  // Toggle sound
  const handleToggleSound = () => {
    const nextVal = soundManager.toggle();
    setSoundEnabled(nextVal);
  };

  // Bot thinking & animation lock state
  const isBotThinking = mode === 'bot' && gameState.turn === 'O' && gameState.winner === null;
  const [isAnimating, setIsAnimating] = useState(false);
  const isInputLockedRef = useRef(false);
  const botSchedulerKeyRef = useRef<string | null>(null);

  // Cancel pending bot timers on: game over, Again/rematch, Home, changing settings, unmounting page, switching modes
  const cancelBotScheduler = useCallback(() => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    botSchedulerKeyRef.current = null;
  }, []);

  // Cancel bot timer on unmount
  useEffect(() => {
    return () => cancelBotScheduler();
  }, [cancelBotScheduler]);

  // Cancel bot timer on game over
  useEffect(() => {
    if (gameState.winner !== null) {
      cancelBotScheduler();
    }
  }, [gameState.winner, cancelBotScheduler]);

  // Replay State
  const [isReplay, setIsReplay] = useState(false);
  const [replayStepIndex, setReplayStepIndex] = useState(0);

  // Derived replay state
  const currentReplayState = useMemo(() => {
    if (!isReplay || !gameState.history || gameState.history.length === 0) return null;
    return getBoardAtMove(gameState.history, replayStepIndex, gameState.config);
  }, [isReplay, gameState.history, replayStepIndex, gameState.config]);

  const replayInsights = useMemo(() => {
    if (!gameState.history) return [];
    return getMoveInsights(gameState.history, gameState.config);
  }, [gameState.history, gameState.config]);

  const currentReplayInsight = replayInsights[replayStepIndex];

  // Restart round
  const handleRestart = useCallback(() => {
    if (gameState.winner) {
      track('rematch_clicked', { mode: 'offline' });
    }
    hasTrackedOfflineGameStartedRef.current = false;
    gameStartTimeRef.current = null;
    cancelBotScheduler();
    setIsAnimating(false);
    isInputLockedRef.current = false;
    setIsReplay(false);
    setVanishedAnim(null);
    setLastRankDelta(null);
    setGameState(createInitialState('X'));
  }, [gameState.winner, cancelBotScheduler]);

  // Mode change
  const handleModeChange = (newMode: 'bot' | 'pvp') => {
    cancelBotScheduler();
    hasTrackedOfflineGameStartedRef.current = false;
    gameStartTimeRef.current = null;
    setMode(newMode);
    setScore({ X: 0, O: 0 });
    setStreak(0);
    setLastWinner(null);
    setLastRankDelta(null);
    handleRestart();
  };

  // Difficulty change
  const handleDifficultyChange = (diff: 'easy' | 'medium' | 'hard') => {
    cancelBotScheduler();
    setBotDifficulty(diff);
  };

  // Record progression completion
  const recordGameCompletion = useCallback(
    (finalState: GameState, winner: Player) => {
      const humanWon = winner === 'X';
      const oppType = mode === 'bot' ? normalizeOpponentType(botDifficulty) : 'human';
      const isFlawless =
        mode === 'bot' && botDifficulty === 'hard' && humanWon
          ? checkNoVanishLoss(finalState.history, 'X', finalState.config)
          : undefined;

      setProgression((prev) => {
        const res = updateStats(prev, {
          mode: '2P',
          opponent: oppType,
          won: humanWon,
          turns: finalState.moveCount,
          history: finalState.history,
          playerSymbol: 'X',
          config: finalState.config,
          flawlessVanish: isFlawless,
        });

        saveProgression(res.nextData);

        if (mode === 'bot') {
          setLastRankDelta(res.rankDelta);
        }

        // Analytics tracking
        for (const badgeId of res.newBadges) {
          track('badge_unlocked', { id: badgeId });
          setBadgeToasts((t) => [...t, { id: `${badgeId}-${Date.now()}`, badgeId }]);
        }
        if (res.rankUpTier) {
          track('rank_up', { tier: res.rankUpTier.toLowerCase() });
        }
        if (res.newStreakReached) {
          track('streak_reached', { n: res.newStreakReached });
        }

        // Games against the bot must NEVER change any rating or create a leaderboard entry
        // Only signed-in users can appear on the leaderboard or earn Elo
        if (mode !== 'bot' && session?.user?.id) {
          try {
            const playerId = session.user.id;
            const playerName = getPlayerName(session.user.name);
            fetch('/api/leaderboard/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playerId,
                playerName,
                opponentId: 'human',
                result: humanWon ? 'win' : 'loss',
              }),
            }).catch(() => { });
          } catch { }
        }

        // Fewest Moves to Beat the Bot Leaderboard (Medium & Hard bot only)
        if (mode === 'bot' && humanWon && (botDifficulty === 'medium' || botDifficulty === 'hard')) {
          const humanMoves = finalState.history.filter((m) => m.player === 'X').length;
          let durationSecs = 10;
          if (gameStartTimeRef.current) {
            const diff = Math.round((Date.now() - gameStartTimeRef.current) / 100) / 10;
            if (!isNaN(diff) && diff >= 0.8) {
              durationSecs = diff;
            }
          }

          if (session?.user?.id) {
            try {
              fetch('/api/leaderboard/bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  difficulty: botDifficulty,
                  history: finalState.history,
                  durationSeconds: durationSecs,
                }),
              })
                .then(
                  (res) =>
                    res.json() as Promise<{
                      success?: boolean;
                      isImprovement?: boolean;
                      record?: { moves: number; durationSeconds: number };
                      rank?: number;
                    }>
                )
                .then((data) => {
                  if (data.success && data.isImprovement && data.record) {
                    const rankStr = data.rank ? ` · Rank #${data.rank}` : '';
                    setBadgeToasts((prevToasts) => [
                      ...prevToasts,
                      {
                        id: `bot-speedrun-${Date.now()}`,
                        badgeId: 'bot-hard',
                        customTitle: 'AI SPEEDRUN RECORD',
                        customName: `${botDifficulty.toUpperCase()} Bot in ${data.record!.moves} moves (${data.record!.durationSeconds}s)${rankStr}`,
                        customIcon: botDifficulty === 'hard' ? 'bot-hard' : 'bot-med',
                      },
                    ]);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('vanish_xo_bot_leaderboard_updated'));
                    }
                  }
                })
                .catch(() => {});
            } catch {}
          } else {
            // Unauthenticated guest notification
            setBadgeToasts((prevToasts) => [
              ...prevToasts,
              {
                id: `guest-bot-win-${Date.now()}`,
                badgeId: 'trophy',
                customTitle: 'AI DEFEATED',
                customName: `Won in ${humanMoves} moves! Sign in to join the AI Leaderboard.`,
                customIcon: 'trophy',
              },
            ]);
          }
        }

        return res.nextData;
      });
    },
    [mode, botDifficulty, session]
  );

  const handleDismissReaction = useCallback((id: string) => {
    setLiveReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleSendReaction = useCallback(
    (reaction: { emoji?: string; quickMessage?: string }) => {
      const isPlayerTurn = gameState.turn === 'X';
      const playerSymbol: MarkSymbol = mode === 'pvp' ? (isPlayerTurn ? 'X' : 'O') : 'X';
      const playerReaction: LiveReaction = {
        id: `rx_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        seatIndex: playerSymbol === 'X' ? 0 : 1,
        symbol: playerSymbol,
        playerName: mode === 'pvp' ? `Player ${playerSymbol}` : (session?.user?.name || 'You'),
        emoji: reaction.emoji,
        quickMessage: reaction.quickMessage,
        timestamp: Date.now(),
      };
      setLiveReactions((prev) => [...prev.slice(-9), playerReaction]);
    },
    [gameState.turn, mode, session?.user?.name]
  );

  // Process a move
  const executeMove = useCallback((cellIndex: number) => {
    setGameState((prevState) => {
      if (prevState.winner !== null || prevState.board[cellIndex] !== null) {
        setIsAnimating(false);
        isInputLockedRef.current = false;
        return prevState;
      }

      const playerMoving = prevState.turn;
      const { nextState, success } = placeMark(prevState, cellIndex);
      if (!success) {
        setIsAnimating(false);
        isInputLockedRef.current = false;
        return prevState;
      }

      // Sound for placement
      soundManager.playPlace(playerMoving);

      // Vanish handling
      if (nextState.lastVanished) {
        soundManager.playVanish();
        triggerHaptic('vanish');
        setVanishedAnim({
          cell: nextState.lastVanished.cell,
          player: nextState.lastVanished.player,
          id: Date.now(),
        });
      }

      // Win handling
      if (nextState.winner) {
        const winner = nextState.winner;
        let durationSeconds: number | undefined;
        if (gameStartTimeRef.current) {
          const diff = Math.round((Date.now() - gameStartTimeRef.current) / 1000);
          if (!isNaN(diff) && diff >= 0) {
            durationSeconds = diff;
          }
        }
        track('game_finished', {
          players: 2,
          bots: mode === 'bot' ? 1 : 0,
          turns: nextState.moveCount,
          mode: 'offline',
          ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
        });
        setScore((prev) => ({
          ...prev,
          [winner]: prev[winner] + 1,
        }));
        setStreak((prev) => (lastWinner === winner ? prev + 1 : 1));
        setLastWinner(winner);

        recordGameCompletion(nextState, winner);
      }

      // Wait for animations to complete before unlocking human input
      const animTime = nextState.lastVanished ? 520 : 260;
      setTimeout(() => {
        setIsAnimating(false);
        isInputLockedRef.current = false;
      }, animTime);

      return nextState;
    });
  }, [lastWinner, mode, recordGameCompletion]);

  // Handle cell click by human player
  const handleCellClick = (index: number) => {
    if (gameState.winner !== null) return;
    if (gameState.board[index] !== null) return;
    if (isInputLockedRef.current || isAnimating || isBotThinking) return;
    if (mode === 'bot' && gameState.turn !== 'X') return;

    trackFirstMove(mode === 'bot' ? 'bot' : 'pass');

    if (isTutorialOpen) {
      try {
        if (tutorialStartTimeRef.current) {
          const spent = Math.round((Date.now() - tutorialStartTimeRef.current) / 1000);
          if (!isNaN(spent) && spent >= 0) {
            track('tutorial_completed', { seconds_spent: spent });
          }
          tutorialStartTimeRef.current = null;
        }
      } catch { }
      markTutorialCompleted();
      setIsTutorialOpen(false);
    }

    // Lock input against double taps
    isInputLockedRef.current = true;
    setIsAnimating(true);

    if (gameState.moveCount === 0 && !hasTrackedOfflineGameStartedRef.current) {
      hasTrackedOfflineGameStartedRef.current = true;
      gameStartTimeRef.current = Date.now();
      track('game_started', {
        players: 2,
        bots: mode === 'bot' ? 1 : 0,
        mode: 'offline',
      });
    }

    executeMove(index);
  };

  // One Turn Scheduler for Bot turns (offline mode)
  useEffect(() => {
    if (mode !== 'bot') return;
    if (gameState.winner !== null) {
      cancelBotScheduler();
      return;
    }
    if (gameState.turn !== 'O') {
      return;
    }

    // Key scheduler by move number and current player to prevent StrictMode duplicate timers
    const turnKey = `${gameState.moveCount}-${gameState.turn}`;
    if (botSchedulerKeyRef.current === turnKey) return;
    botSchedulerKeyRef.current = turnKey;

    // 1. Immediately compute the bot's move in the background
    const plannedBotMove = getBotMove(gameState, botDifficulty);
    if (plannedBotMove === -1) return;

    // 2. Compute delay: random time between 0.5 and 1 second
    const totalDelay = 500 + Math.random() * 500;

    botTimerRef.current = setTimeout(() => {
      botTimerRef.current = null;

      setGameState((currentState) => {
        // Safety: bot must never move after game ended or if turn changed
        if (currentState.turn !== 'O' || currentState.winner !== null) {
          return currentState;
        }

        const { nextState, success } = placeMark(currentState, plannedBotMove);
        if (success) {
          soundManager.playPlace('O');

          if (nextState.lastVanished) {
            soundManager.playVanish();
            triggerHaptic('vanish');
            setVanishedAnim({
              cell: nextState.lastVanished.cell,
              player: nextState.lastVanished.player,
              id: Date.now(),
            });
          }

          if (nextState.winner) {
            const winner = nextState.winner;
            setScore((prev) => ({
              ...prev,
              [winner]: prev[winner] + 1,
            }));
            setStreak((prev) => (lastWinner === winner ? prev + 1 : 1));
            setLastWinner(winner);

            recordGameCompletion(nextState, winner);
          }

          return nextState;
        }

        return currentState;
      });
    }, totalDelay);

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [
    mode,
    gameState,
    botDifficulty,
    lastWinner,
    recordGameCompletion,
    cancelBotScheduler,
  ]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-between px-3 py-4 sm:py-6 overflow-x-hidden">
      {/* First-Time Player Guided Tutorial */}
      <FirstTimeHint
        isOpen={isTutorialOpen && !isSearching && !matchResult}
        step={tutorialStep}
        onNext={handleTutorialNext}
        onSkip={handleTutorialSkip}
      />

      {/* Main Game Screen & Sidebar Container */}
      <div className="w-full max-w-7xl flex flex-col xl:grid xl:grid-cols-[1fr_auto_1fr] items-center xl:items-start justify-center gap-6 xl:gap-8 my-auto">
        {/* Main Game Card (Centered on all screen sizes) */}
        <div className="w-full max-w-md flex flex-col items-center gap-2.5 sm:gap-3 xl:col-start-2 xl:row-start-1 xl:justify-self-center">
          {/* Top Auth Bar */}
          <div className="w-full max-w-[360px] flex items-center justify-end px-1">
            <AuthButton />
          </div>

          {/* Minimalist Logo / Title + Profile Icon + Online Quick Match */}
          <header className="w-full max-w-[360px] flex items-center justify-between px-1 select-none">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                VANISH XO
              </h1>
              <button
                type="button"
                id="header-profile-btn"
                aria-label="Profile and Badges"
                onClick={() => setIsProfileOpen(true)}
                className="w-7 h-7 rounded-xl bg-slate-900/90 border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                style={{
                  borderColor: `${currentRankInfo.color}66`,
                  boxShadow: `0 0 10px ${currentRankInfo.glow}`,
                }}
              >
                <Award size={14} style={{ color: currentRankInfo.color }} />
              </button>
              <Link
                href="/leaderboard"
                id="header-leaderboard-btn"
                aria-label="Global Leaderboard"
                className="w-7 h-7 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              >
                <Trophy size={14} />
              </Link>
            </div>
            <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-xl border border-white/10 backdrop-blur-md">
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  id={`play-online-${count}p-btn`}
                  aria-label={`Quick match ${count} players`}
                  onClick={() => handleStartSearch(count)}
                  className="min-h-[44px] min-w-[44px] px-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 hover:border-cyan-500/40 text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm group"
                >
                  <Users size={12} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <span className="text-slate-200 group-hover:text-white transition-colors">{count}P</span>
                </button>
              ))}
            </div>
          </header>

          {/* Game Over Banner (ABOVE the board, never covering it) */}
          {gameState.winner !== null && (
            <GameOverBanner
              winner={gameState.winner}
              outcome={mode === 'bot' ? (gameState.winner === 'X' ? 'win' : 'lose') : 'spectator'}
              mySymbol={mode === 'bot' ? 'X' : null}
              winnerName={
                gameState.winner === 'X'
                  ? getPlayerName(session?.user)
                  : mode === 'bot'
                    ? 'Bot'
                    : 'Player 2'
              }
              isReplay={isReplay}
              replayMove={currentReplayState?.lastMove}
              replayStepIndex={replayStepIndex}
              totalReplaySteps={gameState.history?.length || 0}
              isReplayTrap={currentReplayInsight?.hasWarning}
              hadVanish={Boolean(gameState.lastVanished)}
            />
          )}

          {/* Top Controls & Offline Player Badges (Hidden when in Replay mode for clarity) */}
          {!isReplay && (
            <TopControls
              mode={mode}
              onModeChange={handleModeChange}
              botDifficulty={botDifficulty}
              onDifficultyChange={handleDifficultyChange}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              onRestart={handleRestart}
              state={gameState}
              score={score}
              streak={streak}
              onOpenProfile={() => setIsProfileOpen(true)}
              rankTierColor={currentRankInfo.color}
              isBotThinking={isBotThinking}
              onOpenTutorial={handleOpenTutorial}
            />
          )}

          {/* Interactive Board at FULL size (dimmed marks, bright ring, ghost vanish, 1s sequence) */}
          <GameBoard
            state={gameState}
            onCellClick={handleCellClick}
            disabled={isBotThinking || isAnimating || (mode === 'bot' && gameState.turn !== 'X') || isReplay}
            vanishedAnim={vanishedAnim}
            onVanishedAnimComplete={() => setVanishedAnim(null)}
            boardOverride={isReplay && currentReplayState ? currentReplayState.board : undefined}
            winningLineOverride={isReplay && currentReplayState ? currentReplayState.winningLine : undefined}
            winnerOverride={isReplay && currentReplayState ? currentReplayState.winner : undefined}
            lastMoveCell={isReplay && currentReplayState ? currentReplayState.lastMove.cell : gameState.lastMoveCell}
            ghostVanish={
              isReplay && currentReplayState
                ? currentReplayState.lastMove.vanished
                : gameState.lastVanished
                  ? { symbol: gameState.lastVanished.player as MarkSymbol, cell: gameState.lastVanished.cell }
                  : null
            }
            isReplay={isReplay}
            isGameOver={gameState.winner !== null}
            tutorialStep={isTutorialOpen ? tutorialStep : null}
          />

          {/* Match Emoji Reactions & Quick Messages Bar */}
          <MatchChat
            reactions={liveReactions}
            onSendReaction={handleSendReaction}
            onDismissReaction={handleDismissReaction}
            className="mt-3 mb-1"
          />

          {/* Rank Change Animated Delta under the board */}
          {gameState.winner !== null && lastRankDelta !== null && (
            <RankDeltaIndicator
              delta={lastRankDelta}
              tierColor={currentRankInfo.color}
            />
          )}

          {/* Game Over Controls (BELOW the board: Again, Replay, Home OR step controls) */}
          {gameState.winner !== null ? (
            <GameOverControls
              winner={gameState.winner}
              outcome={mode === 'bot' ? (gameState.winner === 'X' ? 'win' : 'lose') : 'spectator'}
              history={gameState.history || []}
              isReplay={isReplay}
              replayStepIndex={replayStepIndex}
              onPlayAgain={handleRestart}
              onHome={() => {
                handleRestart();
                track('home_clicked', { from: 'gameover' });
              }}
              onOpenReplay={() => {
                setIsReplay(true);
                setReplayStepIndex(Math.max(0, (gameState.history?.length || 1) - 1));
              }}
              onCloseReplay={() => {
                setIsReplay(false);
              }}
              onStepChange={(newStep) => {
                setReplayStepIndex(newStep);
              }}
            />
          ) : (
            /* Invite & Quick Room Code Join during active play */
            <div className="w-full max-w-[360px] flex items-center gap-2 px-1">
              {/* Invite Button: creates private room */}
              <button
                type="button"
                id="invite-create-btn"
                onClick={() => {
                  const code = generateRoomCode();
                  router.push(`/room/${code}?action=create`);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Share2 size={13} />
                <span>INVITE</span>
              </button>

              {/* Quick Room Code Join Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = joinInput.trim().toUpperCase();
                  if (code.length === 5) {
                    router.push(`/room/${code}`);
                  }
                }}
                className="flex-1 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  id="join-room-input"
                  maxLength={5}
                  placeholder="ROOM CODE"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-900/60 border border-white/10 focus:border-cyan-400 rounded-xl px-2.5 py-2 text-center font-mono text-xs tracking-widest text-cyan-300 placeholder:text-slate-600 focus:outline-none uppercase transition-colors"
                />
                <button
                  type="submit"
                  id="join-room-btn"
                  disabled={joinInput.trim().length !== 5}
                  className="px-3 py-2 bg-cyan-400 text-black font-black text-xs rounded-xl uppercase tracking-wider disabled:opacity-25 disabled:cursor-not-allowed hover:bg-cyan-300 transition-all cursor-pointer shadow-md"
                >
                  JOIN
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Public Top 5 Leaderboard (Below game on mobile/tablet, left column on desktop) */}
        <aside className="w-full max-w-[360px] xl:max-w-[320px] xl:col-start-1 xl:row-start-1 xl:justify-self-end shrink-0">
          <HomeLeaderboard />
        </aside>

        {/* Right column on desktop (or below leaderboard on mobile): 300x250 Adsterra Banner */}
        <aside className="w-full max-w-[360px] xl:max-w-[320px] xl:col-start-3 xl:row-start-1 xl:justify-self-start shrink-0 flex flex-col items-center">
          <AdsterraBanner />
        </aside>
      </div>

      {/* Server Busy Modal */}
      {serverBusy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
          <div className="relative max-w-[280px] w-full bg-[#0a0d16]/95 border border-amber-500/30 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
              <Activity size={36} />
            </div>
            <span className="font-black text-xs tracking-widest uppercase text-amber-300/90">SERVER BUSY</span>
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                id="retry-search-btn"
                onClick={() => {
                  setServerBusy(false);
                  handleStartSearch(searchTargetCount);
                }}
                className="w-full py-3 rounded-2xl bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:bg-cyan-300 transition-all"
                aria-label="Retry"
              >
                <RotateCcw size={16} />
                <span>RETRY</span>
              </button>
              <button
                type="button"
                id="play-vs-bot-modal-btn"
                onClick={() => {
                  setServerBusy(false);
                  setMode('bot');
                }}
                className="w-full py-3 rounded-2xl bg-slate-900 border border-white/15 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-pink-500 hover:text-pink-300 transition-all"
                aria-label="Play vs Bot"
              >
                <Bot size={16} />
                <span>PLAY VS BOT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matchmaking Modal */}
      {isSearching && (
        <MatchmakingModal
          targetCount={searchTargetCount}
          currentCount={currentQueueCount}
          totalSearching={totalSearching}
          matchResult={matchResult}
          onCancel={handleCancelSearch}
          onCountdownComplete={handleCountdownComplete}
        />
      )}

      {/* Profile & Local Progression Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        data={progression}
      />

      {/* Badge Unlock Toasts */}
      <BadgeToast
        toasts={badgeToasts}
        onDismiss={(id) => setBadgeToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* Below the Fold SEO Content for Google Search */}
      <SeoSection />

      {/* Footer Navigation Links */}
      <SiteFooter />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
