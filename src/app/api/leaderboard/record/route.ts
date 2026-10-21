import { NextResponse } from 'next/server';
import { recordGameResult, GameResultInput } from '@/lib/leaderboard';

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
