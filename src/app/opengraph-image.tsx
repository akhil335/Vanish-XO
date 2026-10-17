import { ImageResponse } from 'next/og';

export const alt = 'Vanish XO - Tactical Tic-Tac-Toe';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#06080d',
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(0, 240, 255, 0.15) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255, 0, 127, 0.15) 0%, transparent 45%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow border ring */}
        <div
          style={{
            position: 'absolute',
            inset: '30px',
            border: '2px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '32px',
            display: 'flex',
          }}
        />

        {/* X and O visual */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '40px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '120px',
              fontWeight: 900,
              color: '#00f0ff',
              textShadow: '0 0 40px #00f0ff, 0 0 80px rgba(0, 240, 255, 0.6)',
              display: 'flex',
            }}
          >
            X
          </div>
          <div
            style={{
              fontSize: '120px',
              fontWeight: 900,
              color: '#ff007f',
              textShadow: '0 0 40px #ff007f, 0 0 80px rgba(255, 0, 127, 0.6)',
              display: 'flex',
            }}
          >
            O
          </div>
        </div>

        {/* Game Title */}
        <div
          style={{
            fontSize: '76px',
            fontWeight: 900,
            letterSpacing: '8px',
            color: '#ffffff',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
            display: 'flex',
          }}
        >
          VANISH XO
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '6px',
            color: '#00f0ff',
            marginTop: '16px',
            textTransform: 'uppercase',
            display: 'flex',
          }}
        >
          Tactical Tic-Tac-Toe • Zero Draws
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '18px',
            display: 'flex',
          }}
        >
          3 Marks Max • Oldest Mark Vanishes
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
