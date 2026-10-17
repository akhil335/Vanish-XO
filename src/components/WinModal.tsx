'use client';

import React from 'react';
import { MarkSymbol } from '@/lib/types';

export type GameOutcome = 'win' | 'lose' | 'spectator';

export interface WinModalProps {
  winner: MarkSymbol | null;
  outcome?: GameOutcome;
  mySymbol?: MarkSymbol | null;
  onPlayAgain: () => void;
  onNewMatch?: () => void;
  onHome?: () => void;
  isRematchWaiting?: boolean;
}

/**
 * @deprecated Replaced by GameOverBanner and GameOverControls without full-screen overlay.
 */
export const WinModal: React.FC<WinModalProps> = () => {
  return null;
};
