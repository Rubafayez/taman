import React, { useEffect, useMemo } from 'react';

interface ConfettiBurstProps {
  active: boolean;
  onComplete?: () => void;
}

type ShapeType = 'rect' | 'strip' | 'circle';

interface Piece {
  id: number;
  burstType: 'fall' | 'cannon';
  shape: ShapeType;
  color: string;
  x: string;
  y: string;
  width: number;
  height: number;
  borderRadius: string;
  drift: number;
  sway: number;
  cannonX?: number;
  spin: number;
  delaySec: number;
  durSec: number;
}

// Festive palette with slight bias toward تأمن blue (#4D9BFF)
const FESTIVE_COLORS = [
  '#4D9BFF', // blue (bias)
  '#4D9BFF', // blue (bias)
  '#FFD93D', // yellow
  '#FFB84D', // amber
  '#FF6B9D', // pink
  '#3DDC97', // emerald
  '#A78BFA', // purple
  '#4D9BFF', // blue (bias)
];

const SHAPES: ShapeType[] = ['rect', 'strip', 'circle'];

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({ active, onComplete }) => {
  // Check prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Unmount after 1.8s
  useEffect(() => {
    if (!active) return;

    if (prefersReducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1800);

    return () => clearTimeout(timer);
  }, [active, prefersReducedMotion, onComplete]);

  // Generate pieces ONCE with useMemo when the burst triggers
  // Never touch React state again during animation — pure CSS driven
  const pieces = useMemo<Piece[]>(() => {
    if (!active || prefersReducedMotion) return [];

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
    // ~60 pieces on desktop, ~40 on screens under 480px
    const totalCount = isMobile ? 40 : 60;
    const cannonCount = isMobile ? 5 : 8; // per side
    const fallCount = totalCount - cannonCount * 2; // 30 on mobile, 44 on desktop

    const generated: Piece[] = [];
    let pieceId = 0;

    // 1. Top Edge Spreading Waterfall (fallCount pieces)
    for (let i = 0; i < fallCount; i++) {
      // ONE single release: every piece starts within the same 80ms (0–80ms random delay)
      const delaySec = Number((Math.random() * 0.08).toFixed(3));
      // Fast fall: 1.2–1.6s
      const durSec = Number((1.2 + Math.random() * 0.4).toFixed(3));
      const shape = SHAPES[i % SHAPES.length];
      const color = FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)];

      let baseW = 8;
      let baseH = 14;
      let radius = '2px';

      if (shape === 'strip') {
        baseW = 4;
        baseH = 16;
        radius = '2px';
      } else if (shape === 'circle') {
        baseW = 8;
        baseH = 8;
        radius = '9999px';
      }

      // Spread across full width (3% to 97%)
      const xPct = 3 + (i / (fallCount - 1 || 1)) * 94 + (Math.random() - 0.5) * 3;
      // Drift between ±40–120px
      const driftDir = Math.random() > 0.5 ? 1 : -1;
      const drift = Math.round((40 + Math.random() * 80) * driftDir);
      const sway = Math.round((20 + Math.random() * 35) * (Math.random() > 0.5 ? 1 : -1));
      const spin = Math.round((Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720));

      generated.push({
        id: pieceId++,
        burstType: 'fall',
        shape,
        color,
        x: `${xPct.toFixed(2)}%`,
        y: '-10vh',
        width: baseW,
        height: baseH,
        borderRadius: radius,
        drift,
        sway,
        spin,
        delaySec,
        durSec,
      });
    }

    // 2. Top-Left Cannon: fires inward and downward
    for (let i = 0; i < cannonCount; i++) {
      const delaySec = Number((Math.random() * 0.08).toFixed(3));
      const durSec = Number((1.2 + Math.random() * 0.4).toFixed(3));
      const shape = SHAPES[i % SHAPES.length];
      const color = FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)];

      let baseW = 8;
      let baseH = 14;
      let radius = '2px';

      if (shape === 'strip') {
        baseW = 4;
        baseH = 16;
        radius = '2px';
      } else if (shape === 'circle') {
        baseW = 8;
        baseH = 8;
        radius = '9999px';
      }

      // Inward burst from top-left (+120px to +280px)
      const cannonX = Math.round(120 + Math.random() * 160);
      const drift = Math.round((Math.random() - 0.5) * 50);
      const spin = Math.round((Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720));

      generated.push({
        id: pieceId++,
        burstType: 'cannon',
        shape,
        color,
        x: `${(Math.random() * 5).toFixed(2)}%`,
        y: `${(Math.random() * 4).toFixed(2)}%`,
        width: baseW,
        height: baseH,
        borderRadius: radius,
        drift,
        sway: 0,
        cannonX,
        spin,
        delaySec,
        durSec,
      });
    }

    // 3. Top-Right Cannon: fires inward and downward
    for (let i = 0; i < cannonCount; i++) {
      const delaySec = Number((Math.random() * 0.08).toFixed(3));
      const durSec = Number((1.2 + Math.random() * 0.4).toFixed(3));
      const shape = SHAPES[i % SHAPES.length];
      const color = FESTIVE_COLORS[Math.floor(Math.random() * FESTIVE_COLORS.length)];

      let baseW = 8;
      let baseH = 14;
      let radius = '2px';

      if (shape === 'strip') {
        baseW = 4;
        baseH = 16;
        radius = '2px';
      } else if (shape === 'circle') {
        baseW = 8;
        baseH = 8;
        radius = '9999px';
      }

      // Inward burst from top-right (-120px to -280px)
      const cannonX = Math.round(-(120 + Math.random() * 160));
      const drift = Math.round((Math.random() - 0.5) * 50);
      const spin = Math.round((Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720));

      generated.push({
        id: pieceId++,
        burstType: 'cannon',
        shape,
        color,
        x: `${(95 + Math.random() * 5).toFixed(2)}%`,
        y: `${(Math.random() * 4).toFixed(2)}%`,
        width: baseW,
        height: baseH,
        borderRadius: radius,
        drift,
        sway: 0,
        cannonX,
        spin,
        delaySec,
        durSec,
      });
    }

    return generated;
  }, [active, prefersReducedMotion]);

  if (!active || prefersReducedMotion || pieces.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((p) => {
        const animationClass =
          p.burstType === 'fall' ? 'confetti-piece-fall' : 'confetti-piece-cannon';

        // Pure flat colors (no box-shadow), purely GPU-composited transform & opacity
        const style: React.CSSProperties & Record<string, string | number> = {
          position: 'absolute',
          left: p.x,
          top: p.y,
          width: `${p.width}px`,
          height: `${p.height}px`,
          backgroundColor: p.color,
          borderRadius: p.borderRadius,
          '--drift': `${p.drift}px`,
          '--sway': `${p.sway}px`,
          '--spin': `${p.spin}deg`,
          '--delay': `${p.delaySec}s`,
          '--dur': `${p.durSec}s`,
        };

        if (p.burstType === 'cannon' && p.cannonX !== undefined) {
          style['--cannon-x'] = `${p.cannonX}px`;
        }

        return <span key={p.id} className={animationClass} style={style} />;
      })}
    </div>
  );
};
