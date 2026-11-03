import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { registerRoomPlayerSession, registerRoomGuestSession } from '@/lib/leaderboard';

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = (await request.json()) as { roomCode?: string; seatIndex?: number; playerId?: string };
    const { roomCode, seatIndex = 0, playerId = '' } = body;

    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 });
    }

    if (session?.user?.id) {
      await registerRoomPlayerSession(
        roomCode,
        seatIndex,
        playerId,
        session.user.id,
        session.user.name || undefined
      );
      return NextResponse.json({
        verified: true,
        userId: session.user.id,
        name: session.user.name,
      });
    } else {
      await registerRoomGuestSession(roomCode, seatIndex, playerId);
      return NextResponse.json({
        verified: false,
        isGuest: true,
      });
    }
  } catch (error: unknown) {
    console.error('[room:session] Failed to register room session:', error);
    const message = error instanceof Error ? error.message : 'Failed to register session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
