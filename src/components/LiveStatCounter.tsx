import React, { useEffect, useState } from 'react';
import { toArabicDigits } from '../config/strings.ar';
import { CheckCircle2 } from 'lucide-react';

interface LiveStatCounterProps {
  target?: number;
  durationMs?: number;
}

export const LiveStatCounter: React.FC<LiveStatCounterProps> = ({
  target = 47,
  durationMs = 900,
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setCount(target);
      return;
    }

    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // Ease out quad
      const current = Math.floor(progress * target);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, durationMs]);

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-xs border border-white/15 text-[#DCE8FF] text-[13px] sm:text-[14px] font-medium shadow-xs select-none">
      <CheckCircle2 className="w-4 h-4 text-[#12B981] shrink-0" aria-hidden="true" />
      <span>
        <strong className="text-white font-bold font-mono text-[15px] sm:text-[16px]">
          {toArabicDigits(count)}
        </strong>{' '}
        غرض رجع لصاحبه
      </span>
    </div>
  );
};
