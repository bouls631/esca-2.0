import { useRef } from 'react';

// Swipe simple : droite = onRight, gauche = onLeft, bas = onDown (fallback : boutons sous chaque carte)
export function useSwipe(p: { onRight?: () => void; onLeft?: () => void; onDown?: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      const TH = 48;
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx > 0) p.onRight?.();
        else p.onLeft?.();
      } else if (dy > TH * 1.5) p.onDown?.();
    },
  };
}
