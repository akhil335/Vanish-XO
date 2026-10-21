import { NextResponse } from 'next/server';
import { getLeaderboard, recordGameResult, GameResultInput } from '@/lib/leaderboard';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;

    const leaderboard = await getLeaderboard(limit);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GameResultInput;
    const result = await recordGameResult(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to record game result:', error);
    return NextResponse.json({ error: error?.message || 'Failed to record game result' }, { status: 400 });
  }
}
