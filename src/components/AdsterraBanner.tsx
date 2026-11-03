'use client';

import React, { useEffect, useRef } from 'react';

export const AdsterraBanner: React.FC = () => {
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoadedRef.current) return;
    isLoadedRef.current = true;

    try {
      const win = window as any;
      if (typeof win.atAsyncOptions !== 'object') {
        win.atAsyncOptions = [];
      }
      
      const alreadyConfigured = win.atAsyncOptions.some(
        (opt: any) => opt.key === 'a1d3963a584b338cd8ac50a69b822992'
      );

      if (!alreadyConfigured) {
        win.atAsyncOptions.push({
          key: 'a1d3963a584b338cd8ac50a69b822992',
          format: 'js',
          async: true,
          container: 'atContainer-a1d3963a584b338cd8ac50a69b822992',
          params: {},
        });
      }

      const hasScript = document.querySelector('script[src*="a1d3963a584b338cd8ac50a69b822992"]');
      if (!hasScript) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        script.src = 'https://bauval.org/22/a1d3963a584b338cd8ac50a69b822992';
        document.head.appendChild(script);
      }
    } catch {
      // Ignore if blocked by browser
    }
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-center my-4 select-none">
      <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 mb-1.5">
        ADVERTISEMENT
      </span>
      <div
        id="atContainer-a1d3963a584b338cd8ac50a69b822992"
        className="w-[300px] h-[250px] min-w-[300px] min-h-[250px] bg-slate-900/50 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-lg backdrop-blur-sm"
      />
    </div>
  );
};
