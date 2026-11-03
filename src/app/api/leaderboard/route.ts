import { NextResponse } from 'next/server';
import { getLeaderboard, recordGameResult, GameResultInput } from '@/lib/leaderboard';
import { auth } from '@/auth';
import { sanitizePlayerName } from '@/lib/player';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;

    const leaderboard = await getLeaderboard(limit);
    return NextResponse.json(
      { leaderboard },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized: Only signed-in players can record rated results.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as GameResultInput;
    const playerId = session.user.id;
    const rawName = body.playerName || session.user.name || undefined;
    const playerName = rawName ? sanitizePlayerName(rawName) : undefined;

    const result = await recordGameResult({
      ...body,
      playerId,
      playerName,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to record game result:', error);
    return NextResponse.json({ error: error?.message || 'Failed to record game result' }, { status: 400 });
  }
}
