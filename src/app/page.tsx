'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  placeMark,
  getBotMove,
  Player,
} from '@/lib/game';
import { soundManager, triggerHaptic } from '@/lib/audio';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/GameBoard';
import { TopControls } from '@/components/TopControls';
import { WinModal } from '@/components/WinModal';
import { FirstTimeHint } from '@/components/FirstTimeHint';
import { SeoSection } from '@/components/SeoSection';

export default function Home() {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState('');
  const [gameState, setGameState] = useState<GameState>(() => createInitialState('X'));
  const [mode, setMode] = useState<'bot' | 'pvp'>('bot');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [score, setScore] = useState<{ X: number; O: number }>({ X: 0, O: 0 });
  const [streak, setStreak] = useState<number>(0);
  const [lastWinner, setLastWinner] = useState<Player | null>(null);

  const [vanishedAnim, setVanishedAnim] = useState<{
    cell: number;
    player: Player;
    id: number;
  } | null>(null);

  const botTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Toggle sound
  const handleToggleSound = () => {
    const nextVal = soundManager.toggle();
    setSoundEnabled(nextVal);
  };

  // Derived bot thinking status
  const isBotThinking = mode === 'bot' && gameState.turn === 'O' && gameState.winner === null;

  // Restart round
  const handleRestart = useCallback(() => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setVanishedAnim(null);
    setGameState(createInitialState('X'));
  }, []);

  // Mode change
  const handleModeChange = (newMode: 'bot' | 'pvp') => {
    setMode(newMode);
    setScore({ X: 0, O: 0 });
    setStreak(0);
    setLastWinner(null);
    handleRestart();
  };

  // Difficulty change
  const handleDifficultyChange = (diff: 'easy' | 'medium' | 'hard') => {
    setBotDifficulty(diff);
  };

  // Process a move
  const executeMove = useCallback((cellIndex: number) => {
    setGameState((prevState) => {
      if (prevState.winner !== null || prevState.board[cellIndex] !== null) {
        return prevState;
      }

      const playerMoving = prevState.turn;
      const { nextState, success } = placeMark(prevState, cellIndex);
      if (!success) return prevState;

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
        setScore((prev) => ({
          ...prev,
          [winner]: prev[winner] + 1,
        }));
        setStreak((prev) => (lastWinner === winner ? prev + 1 : 1));
        setLastWinner(winner);
      }

      return nextState;
    });
  }, [lastWinner]);

  // Handle cell click by human player
  const handleCellClick = (index: number) => {
    if (gameState.winner !== null) return;
    if (gameState.board[index] !== null) return;
    if (isBotThinking) return;
    if (mode === 'bot' && gameState.turn === 'O') return;

    executeMove(index);
  };

  // Bot Turn Automation
  useEffect(() => {
    if (mode !== 'bot') return;
    if (gameState.winner !== null) return;
    if (gameState.turn !== 'O') return;

    botTimerRef.current = setTimeout(() => {
      setGameState((currentState) => {
        if (currentState.turn !== 'O' || currentState.winner !== null) {
          return currentState;
        }

        const botMove = getBotMove(currentState, botDifficulty);
        if (botMove !== -1) {
          const { nextState, success } = placeMark(currentState, botMove);
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
            }

            return nextState;
          }
        }

        return currentState;
      });
    }, 500); // 500ms natural bot reaction time

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
      }
    };
  }, [mode, gameState.turn, gameState.winner, botDifficulty, lastWinner]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-between px-3 py-4 sm:py-6 overflow-x-hidden">
      {/* Visual First-Time Tutorial (No words, localStorage cached) */}
      <FirstTimeHint />

      {/* Main Game Screen (Immediate start, mobile optimized) */}
      <div className="w-full max-w-md flex flex-col items-center gap-4 sm:gap-6 my-auto">
        {/* Minimalist Logo / Title */}
        <header className="flex flex-col items-center gap-0.5 select-none">
          <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-pink-500 drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]">
            VANISH XO
          </h1>
        </header>

        {/* Top Controls & Player Badges */}
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
        />

        {/* Interactive 3x3 Grid */}
        <GameBoard
          state={gameState}
          onCellClick={handleCellClick}
          disabled={isBotThinking}
          vanishedAnim={vanishedAnim}
          onVanishedAnimComplete={() => setVanishedAnim(null)}
        />

        {/* Quick Room Code Join */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = joinInput.trim().toUpperCase();
            if (code.length === 4) {
              router.push(`/room/${code}`);
            }
          }}
          className="w-full max-w-[360px] flex items-center gap-2 px-1"
        >
          <input
            type="text"
            id="join-room-input"
            maxLength={4}
            placeholder="ROOM CODE"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-900/60 border border-white/10 focus:border-cyan-400 rounded-xl px-3 py-2 text-center font-mono text-xs tracking-widest text-cyan-300 placeholder:text-slate-600 focus:outline-none uppercase transition-colors"
          />
          <button
            type="submit"
            id="join-room-btn"
            disabled={joinInput.trim().length !== 4}
            className="px-4 py-2 bg-cyan-400 text-black font-black text-xs rounded-xl uppercase tracking-wider disabled:opacity-25 disabled:cursor-not-allowed hover:bg-cyan-300 transition-all cursor-pointer shadow-md"
          >
            JOIN
          </button>
        </form>
      </div>

      {/* Win Modal with Confetti and 'Again' button */}
      <WinModal
        winner={gameState.winner}
        onPlayAgain={handleRestart}
      />

      {/* Below the Fold SEO Content for Google Search */}
      <SeoSection />
    </main>
  );
}
