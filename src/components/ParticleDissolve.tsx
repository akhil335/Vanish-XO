'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Player } from '@/lib/game';

interface ParticleDissolveProps {
  player: Player;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

export const ParticleDissolve: React.FC<ParticleDissolveProps> = ({
  player,
  onComplete,
}) => {
  const isCyan = player === 'X';
  const color = isCyan ? '#00f0ff' : '#ff007f';
  const glow = isCyan
    ? '0 0 10px rgba(0, 240, 255, 0.9)'
    : '0 0 10px rgba(255, 0, 127, 0.9)';

  const particles: Particle[] = useMemo(() => {
    const list: Particle[] = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (((i * 7) % 5) - 2) * 0.1;
      const distance = 25 + ((i * 13) % 25);
      list.push({
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 3 + ((i * 3) % 4),
        delay: (i % 4) * 0.02,
      });
    }
    return list;
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
      {/* Central dissolving shockwave ring */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0.9 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="absolute w-16 h-16 rounded-full border border-dashed"
        style={{ borderColor: color, boxShadow: glow }}
      />

      {/* Exploding neon particles */}
      {particles.map((p, idx) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1.2, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: 0,
            opacity: 0,
          }}
          transition={{
            duration: 0.4,
            delay: p.delay,
            ease: [0.15, 0.85, 0.35, 1],
          }}
          onAnimationComplete={idx === 0 ? onComplete : undefined}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
      ))}
    </div>
  );
};
