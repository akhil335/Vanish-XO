import { NextResponse } from 'next/server';
import { z } from 'zod';

const ReportSchema = z.object({
  roomCode: z.string().min(1).max(10),
  reportedSeat: z.number().int().min(0).max(3),
  messageText: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ReportSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'INVALID_REPORT' }, { status: 400 });
    }

    const { roomCode, reportedSeat, messageText } = result.data;

    // Log strictly room code, reported player seat, and message text to Vercel server log
    console.warn(`[CHAT REPORT] Room: ${roomCode}, Reported Seat: ${reportedSeat}, Message: "${messageText}"`);

    return NextResponse.json({ success: true, message: 'Thanks, reported.' });
  } catch (error) {
    console.error('Failed to log report:', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
