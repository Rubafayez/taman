import React, { useEffect, useState } from 'react';
import { toArabicDigits } from '../config/strings.ar';

interface MatchScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const MatchScoreRing: React.FC<MatchScoreRingProps> = ({
  score,
  size = 64,
  strokeWidth = 6,
  className = '',
  showLabel = false,
  label,
}) => {
  const [currentScore, setCurrentScore] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setCurrentScore(score);
      return;
    }

    let startTime: number | null = null;
    const duration = 850;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCurrentScore(Math.round(easeProgress * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrentScore(score);
      }
    };

    const animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [score]);

  const strokeDashoffset = circumference - (currentScore / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center shrink-0 ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg]"
          aria-hidden="true"
        >
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          {/* Animated Blue Progress Arc in --blue-400 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#4D9BFF"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>

        {/* Number counting up inside the ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-extrabold text-[#4D9BFF] font-mono tabular-nums tracking-tight leading-none"
            style={{ fontSize: size <= 48 ? '12px' : '15px' }}
          >
            %{toArabicDigits(currentScore)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-[12px] font-medium text-[#B4BECB] mt-1.5 select-none">
          {label || 'درجة التوافق'}
        </span>
      )}
    </div>
  );
};
