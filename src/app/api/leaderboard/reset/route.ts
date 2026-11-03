import { NextResponse } from 'next/server';
import { resetLeaderboard } from '@/lib/leaderboard';

export async function POST(request: Request) {
  try {
    const expectedSecret =
      process.env.ADMIN_RESET_SECRET || process.env.LEADERBOARD_RESET_SECRET;

    // Fail closed if the secret is not set in the server environment
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Forbidden: ADMIN_RESET_SECRET is not configured on the server.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const secretFromParam = searchParams.get('secret');
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const confirmParam = searchParams.get('confirm');

    let secretFromBody: string | undefined;
    let confirmFromBody: string | undefined;

    try {
      const body = (await request.json()) as { secret?: string; confirm?: string } | null;
      secretFromBody = body?.secret;
      confirmFromBody = body?.confirm;
    } catch {
      // Body may be empty or not JSON
    }

    const providedSecret = secretFromParam || authHeader || secretFromBody;

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing secret' },
        { status: 401 }
      );
    }

    // Explicit confirmation check to prevent accidental triggers
    const confirmVal = (confirmParam || confirmFromBody || '').trim();
    if (confirmVal !== 'RESET' && confirmVal !== 'yes') {
      return NextResponse.json(
        {
          error:
            'Confirmation required. Please provide confirm=RESET or confirm=yes to confirm deletion.',
        },
        { status: 400 }
      );
    }

    const result = await resetLeaderboard();
    return NextResponse.json({
      success: true,
      message: 'All leaderboard data, ratings, and player profiles have been deleted.',
      clearedProfiles: result.clearedCount,
    });
  } catch (error: any) {
    console.error('Failed to reset leaderboard:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reset leaderboard' },
      { status: 500 }
    );
  }
}
