import React, { useEffect, useState, useRef } from 'react';

interface ConstellationDot {
  id: number;
  x: number;
  y: number;
  r: number;
  twinkle?: boolean;
  twinkleDur?: string;
  twinkleDelay?: string;
}

interface ActiveConnection {
  key: string;
  from: ConstellationDot;
  to: ConstellationDot;
  length: number;
}

// 18 hand-placed coordinates spanning the 1000x400 viewBox
const DOTS: ConstellationDot[] = [
  { id: 0, x: 95, y: 70, r: 2.0 },
  { id: 1, x: 180, y: 130, r: 2.2, twinkle: true, twinkleDur: '4.2s', twinkleDelay: '0s' },
  { id: 2, x: 140, y: 270, r: 1.8 },
  { id: 3, x: 270, y: 85, r: 2.5, twinkle: true, twinkleDur: '3.6s', twinkleDelay: '1.2s' },
  { id: 4, x: 300, y: 220, r: 1.7 },
  { id: 5, x: 390, y: 110, r: 2.3, twinkle: true, twinkleDur: '4.8s', twinkleDelay: '2.5s' },
  { id: 6, x: 450, y: 280, r: 1.6 },
  { id: 7, x: 530, y: 75, r: 2.4, twinkle: true, twinkleDur: '3.2s', twinkleDelay: '0.7s' },
  { id: 8, x: 580, y: 210, r: 1.9 },
  { id: 9, x: 660, y: 115, r: 2.2, twinkle: true, twinkleDur: '4.5s', twinkleDelay: '3.1s' },
  { id: 10, x: 730, y: 260, r: 1.7 },
  { id: 11, x: 800, y: 90, r: 2.5, twinkle: true, twinkleDur: '3.8s', twinkleDelay: '1.8s' },
  { id: 12, x: 870, y: 200, r: 2.0 },
  { id: 13, x: 940, y: 120, r: 1.8, twinkle: true, twinkleDur: '4.0s', twinkleDelay: '2.2s' },
  { id: 14, x: 915, y: 310, r: 2.1 },
  { id: 15, x: 360, y: 330, r: 1.6 },
  { id: 16, x: 630, y: 330, r: 2.0, twinkle: true, twinkleDur: '4.6s', twinkleDelay: '4.0s' },
  { id: 17, x: 210, y: 340, r: 1.9 },
];

// Curated list of nearby dot pairs to connect in a calm rhythm
const CANDIDATE_PAIRS: [number, number][] = [
  [1, 3],
  [8, 9],
  [4, 6],
  [11, 13],
  [0, 1],
  [5, 7],
  [10, 12],
  [4, 15],
  [7, 8],
  [12, 14],
  [1, 2],
  [10, 16],
  [3, 5],
  [2, 17],
];

export const HeroConstellation: React.FC = () => {
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const pairIndexRef = useRef(0);
  const counterRef = useRef(0);

  useEffect(() => {
    // Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    const spawnConnection = () => {
      const pair = CANDIDATE_PAIRS[pairIndexRef.current % CANDIDATE_PAIRS.length];
      pairIndexRef.current += 1;
      counterRef.current += 1;

      const fromDot = DOTS[pair[0]];
      const toDot = DOTS[pair[1]];
      const length = Math.hypot(toDot.x - fromDot.x, toDot.y - fromDot.y);

      const newConnection: ActiveConnection = {
        key: `conn-${counterRef.current}-${pair[0]}-${pair[1]}`,
        from: fromDot,
        to: toDot,
        length: Math.max(1, Math.round(length)),
      };

      // Keep only up to 2 visible connections at a time
      setConnections((prev) => [...prev.slice(-1), newConnection]);
    };

    // Initial connection after a short delay so the hero is rendered
    const initialTimer = setTimeout(spawnConnection, 600);

    // Pick a new connection every 2.4 seconds
    const interval = setInterval(spawnConnection, 2400);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* 1. Base Static and Twinkling Dots */}
      <g>
        {DOTS.map((dot) => {
          if (dot.twinkle) {
            return (
              <circle
                key={dot.id}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill="#FFFFFF"
                className="hero-dot-twinkle"
                style={
                  {
                    '--twinkle-dur': dot.twinkleDur || '4s',
                    animationDelay: dot.twinkleDelay || '0s',
                  } as React.CSSProperties
                }
              />
            );
          }
          return (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="rgba(255, 255, 255, 0.12)"
            />
          );
        })}
      </g>

      {/* 2. Active Connecting Lines & Endpoint Pulse Rings */}
      <g>
        {connections.map((conn) => (
          <g key={conn.key}>
            {/* The line that draws over 700ms, holds 600ms, and fades over 500ms */}
            <line
              x1={conn.from.x}
              y1={conn.from.y}
              x2={conn.to.x}
              y2={conn.to.y}
              strokeDasharray={conn.length}
              className="hero-conn-line"
              style={
                {
                  '--line-len': `${conn.length}px`,
                } as React.CSSProperties
              }
            />

            {/* Instant line completes (at 700ms), both endpoint dots pulse once: ring expands r=2 to r=9 fading out */}
            <circle
              cx={conn.from.x}
              cy={conn.from.y}
              className="hero-match-pulse"
            />
            <circle
              cx={conn.to.x}
              cy={conn.to.y}
              className="hero-match-pulse"
            />
          </g>
        ))}
      </g>
    </svg>
  );
};
