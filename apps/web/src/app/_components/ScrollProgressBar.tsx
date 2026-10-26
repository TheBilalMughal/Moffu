'use client';

import { useEffect, useState } from 'react';

export function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el  = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) { setPct(0); return; }
      setPct(Math.min(100, Math.round((window.scrollY / max) * 100)));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="sticky top-16 z-40 h-[3px] w-full bg-transparent overflow-hidden">
      <div
        className="h-full bg-[#0D4C3C] transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      />
    </div>
  );
}
