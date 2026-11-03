'use client';

import React, { useEffect, useRef } from 'react';

export const AdsterraSocialBar: React.FC = () => {
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoadedRef.current) return;
    if (document.querySelector('script[src*="371b2d04b723fcafbfca9829a460b77d"]')) return;
    isLoadedRef.current = true;

    try {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://bauval.org/14/371b2d04b723fcafbfca9829a460b77d';
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.body.appendChild(script);
    } catch {
      // Ignore if blocked by browser
    }
  }, []);

  return null;
};

