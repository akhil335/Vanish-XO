import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#06080d',
          borderRadius: '112px',
          border: '14px solid rgba(0, 240, 255, 0.4)',
          position: 'relative',
        }}
      >
        {/* Top 3 Pips (Vanishing Mechanic) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '30px',
            position: 'absolute',
            top: '48px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#00f0ff',
              boxShadow: '0 0 12px #00f0ff',
            }}
          />
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#a855f7',
            }}
          />
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px dashed #ff007f',
              opacity: 0.6,
            }}
          />
        </div>

        {/* XO Center Emblem */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '210px',
              fontWeight: 900,
              color: '#00f0ff',
              textShadow: '0 0 35px #00f0ff',
              lineHeight: 1,
            }}
          >
            X
          </div>
          <div
            style={{
              fontSize: '210px',
              fontWeight: 900,
              color: '#ff007f',
              textShadow: '0 0 35px #ff007f',
              lineHeight: 1,
            }}
          >
            O
          </div>
        </div>

        {/* Bottom Tag */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '24px',
            fontWeight: 900,
            letterSpacing: '6px',
            color: '#64748b',
          }}
        >
          VANISH
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
