import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getBotLeaderboard,
  recordBotVictory,
  BotDifficulty,
  getPlayerBotRecord,
} from '@/lib/bot-leaderboard';
import { MoveRecord } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDiff = searchParams.get('difficulty')?.toLowerCase();
    const difficulty: BotDifficulty = rawDiff === 'hard' ? 'hard' : 'medium';

    const rawLimit = searchParams.get('limit');
    const limit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit, 10) || 50), 100) : 50;

    const leaderboard = await getBotLeaderboard(difficulty, limit);

    // If an authenticated user requested, also attach their personal record
    let myRecord = null;
    const session = await auth();
    if (session?.user?.id) {
      myRecord = await getPlayerBotRecord(difficulty, session.user.id);
    }

    return NextResponse.json({
      difficulty,
      leaderboard,
      myRecord,
    });
  } catch (error: unknown) {
    console.error('[leaderboard:bot:GET] Failed to fetch bot leaderboard:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch bot leaderboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Sign in to record scores to the AI Speedrun Leaderboard.',
          message: 'Sign in with Google to submit your bot records.',
        },
        { status: 401 }
      );
    }

    interface PostBody {
      difficulty?: string;
      history?: MoveRecord[];
      durationSeconds?: number;
    }

    const body = (await request.json()) as PostBody;
    const { difficulty: rawDiff, history, durationSeconds } = body;

    if (!rawDiff || (rawDiff !== 'medium' && rawDiff !== 'hard')) {
      return NextResponse.json(
        { success: false, error: 'Difficulty must be "medium" or "hard"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid game history is required' },
        { status: 400 }
      );
    }

    if (typeof durationSeconds !== 'number' || isNaN(durationSeconds) || durationSeconds <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid durationSeconds is required' },
        { status: 400 }
      );
    }

    const difficulty = rawDiff as BotDifficulty;
    const playerId = session.user.id;
    const playerName = session.user.name || undefined;

    const result = await recordBotVictory({
      playerId,
      playerName,
      difficulty,
      history,
      durationSeconds,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record bot game';
    console.error('[leaderboard:bot:POST] Error:', message);

    if (message.includes('already been submitted')) {
      return NextResponse.json({ success: false, error: message, duplicate: true }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

