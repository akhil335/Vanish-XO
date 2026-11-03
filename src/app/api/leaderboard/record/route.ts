import { NextResponse } from 'next/server';
import {
  recordMatchResult,
  getRoomSeatUser,
  markGameRecorded,
} from '@/lib/leaderboard';
import { auth } from '@/auth';
import { getRealtimeConfig } from '@/lib/config';
import { RoomState } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          rated: false,
          error: 'Unauthorized',
          message: 'Ranked games need both players signed in.',
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as any;
    const { roomCode, roomState: clientRoomState } = body;

    // Reject standalone requests without a roomCode (e.g. old bot or pass & play calls)
    if (!roomCode) {
      return NextResponse.json(
        {
          success: false,
          rated: false,
          error: 'Only online room games can be ranked.',
          message: 'Only online room games can be ranked.',
        },
        { status: 400 }
      );
    }

    const normCode = roomCode.toUpperCase().trim();

    // 1. Fetch authoritative room state from PartyServer directly if available
    let authoritativeState: RoomState | null = null;
    const realtimeConfig = getRealtimeConfig();
    if (realtimeConfig?.host) {
      try {
        const protocol = realtimeConfig.protocol === 'wss' ? 'https' : 'http';
        const res = await fetch(`${protocol}://${realtimeConfig.host}/parties/main/${normCode}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          const data = (await res.json()) as RoomState;
          if (data && data.status === 'finished') {
            authoritativeState = data;
          }
        }
      } catch {
        // Fall back to client payload if direct DO HTTP fetch is unavailable
      }
    }

    const stateToVerify: RoomState = authoritativeState || clientRoomState;

    if (!stateToVerify || stateToVerify.status !== 'finished') {
      return NextResponse.json(
        {
          success: false,
          rated: false,
          error: 'Game is not finished.',
          message: 'Game is not finished.',
        },
        { status: 400 }
      );
    }

    // 2. Do not rate a game that was abandoned or where a player left before finishing
    if (
      stateToVerify.isAbandoned ||
      stateToVerify.pausedReason === 'opponent_left' ||
      stateToVerify.pausedReason === 'opponent_abandoned'
    ) {
      console.log(`[leaderboard:record] Room ${normCode}: game was abandoned, not rating.`);
      return NextResponse.json({
        success: true,
        rated: false,
        reason: 'ABANDONED',
        message: 'Abandoned games are unrated.',
      });
    }

    // 3. Must be a 2-player human game with a clear winner
    const seats = stateToVerify.seats || [];
    if (seats.length !== 2 || seats.some((s) => s.isBot)) {
      return NextResponse.json({
        success: true,
        rated: false,
        reason: 'NOT_2P_HUMAN',
        message: 'Only 2-player human matches can be ranked.',
      });
    }

    const winnerSymbol = stateToVerify.winner;
    if (!winnerSymbol || (winnerSymbol !== 'X' && winnerSymbol !== 'O')) {
      return NextResponse.json({
        success: true,
        rated: false,
        reason: 'NO_WINNER',
        message: 'Game ended without a winner.',
      });
    }

    // 4. Verify both players using server-side sessions
    let user0 = await getRoomSeatUser(normCode, 0, seats[0]?.playerId || undefined);
    let user1 = await getRoomSeatUser(normCode, 1, seats[1]?.playerId || undefined);

    // Link caller's verified session to caller's seat if not already cached
    const callerId = session.user.id;
    const callerName = session.user.name || undefined;
    if (seats[0]?.playerId && (!user0 || user0.isGuest)) {
      if (seats[0].playerId === body.callerPlayerId || seats[0].userId === callerId) {
        user0 = { userId: callerId, name: callerName || seats[0].playerName || 'Player 1', isGuest: false };
      }
    }
    if (seats[1]?.playerId && (!user1 || user1.isGuest)) {
      if (seats[1].playerId === body.callerPlayerId || seats[1].userId === callerId) {
        user1 = { userId: callerId, name: callerName || seats[1].playerName || 'Player 2', isGuest: false };
      }
    }

    // Check if seats carry verified user IDs from client join handshake
    if ((!user0 || user0.isGuest) && seats[0]?.userId && !seats[0].userId.startsWith('p_') && seats[0].userId !== 'guest') {
      user0 = { userId: seats[0].userId, name: seats[0].playerName || 'Player 1', isGuest: false };
    }
    if ((!user1 || user1.isGuest) && seats[1]?.userId && !seats[1].userId.startsWith('p_') && seats[1].userId !== 'guest') {
      user1 = { userId: seats[1].userId, name: seats[1].playerName || 'Player 2', isGuest: false };
    }

    const isUser0Valid = Boolean(
      user0 && !user0.isGuest && user0.userId && !user0.userId.startsWith('p_') && user0.userId !== 'guest'
    );
    const isUser1Valid = Boolean(
      user1 && !user1.isGuest && user1.userId && !user1.userId.startsWith('p_') && user1.userId !== 'guest'
    );

    if (!isUser0Valid || !isUser1Valid) {
      console.log(`[leaderboard:record] Room ${normCode}: one or both players are guests. Not rating.`);
      return NextResponse.json({
        success: true,
        rated: false,
        reason: 'GUEST_PLAYER',
        message: 'Ranked games need both players signed in.',
      });
    }

    if (user0!.userId === user1!.userId) {
      return NextResponse.json({
        success: true,
        rated: false,
        reason: 'SAME_USER',
        message: 'Cannot play ranked match against yourself.',
      });
    }

    // 5. Prevent double-counting per game
    const gameId =
      stateToVerify.gameId ||
      body.gameId ||
      `${normCode}_${stateToVerify.winningLine?.join('-') || 'win'}_${stateToVerify.history?.length || 0}`;

    const lockKey = `${normCode}:${gameId}`;
    const isFirstRecord = await markGameRecorded(lockKey);
    if (!isFirstRecord) {
      console.log(`[leaderboard:record] Room ${normCode}: game ${gameId} already recorded. Skipping.`);
      return NextResponse.json({
        success: true,
        rated: true,
        alreadyRecorded: true,
        message: 'Game result already recorded.',
      });
    }

    // 6. Record rating update for both players
    const winnerSeat = seats.find((s) => s.symbol === winnerSymbol);
    const loserSeat = seats.find((s) => s.symbol !== winnerSymbol);

    if (!winnerSeat || !loserSeat) {
      return NextResponse.json({ error: 'Failed to resolve winning seat' }, { status: 400 });
    }

    const winnerUser = winnerSeat.seatIndex === 0 ? user0! : user1!;
    const loserUser = loserSeat.seatIndex === 0 ? user0! : user1!;

    const result = await recordMatchResult(
      winnerUser.userId,
      winnerUser.name,
      loserUser.userId,
      loserUser.name,
      1
    );

    console.log(
      `[leaderboard:record] Recorded room ${normCode} result: Winner ${winnerUser.name} (${result.playerA.rating}, +${result.deltaA}), Loser ${loserUser.name} (${result.playerB.rating}, ${result.deltaB})`
    );

    return NextResponse.json({
      success: true,
      rated: true,
      gameId,
      winner: {
        id: winnerUser.userId,
        name: winnerUser.name,
        rating: result.playerA.rating,
        delta: result.deltaA,
      },
      loser: {
        id: loserUser.userId,
        name: loserUser.name,
        rating: result.playerB.rating,
        delta: result.deltaB,
      },
    });
  } catch (error: any) {
    console.error('[leaderboard:record] Server error recording result:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to record game result',
        message: 'Unable to record ranked result. Please try again.',
      },
      { status: 500 }
    );
  }
}
