import React, { useMemo, useEffect, useState } from 'react';
import { CampusItem } from '../types';
import { toArabicDigits } from '../config/strings.ar';

interface StatStripProps {
  items: CampusItem[];
  isLoading?: boolean;
}

interface StatCounterProps {
  target: number;
  duration?: number;
}

const StatCounter: React.FC<StatCounterProps> = ({ target, duration = 1200 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || target === 0) {
      setDisplayValue(target);
      return;
    }

    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * target));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  // A real zero renders as "٠", not a dash. The "+" suffix only appears when value > 0.
  if (target === 0) {
    return <span>{toArabicDigits(0)}</span>;
  }

  return (
    <span dir="ltr">
      {toArabicDigits(displayValue)}+
    </span>
  );
};

export const StatStrip: React.FC<StatStripProps> = ({ items, isLoading = false }) => {
  // Derive four values directly with useMemo from items prop (never copied to local state)
  const { totalReports, resolvedItems, coveredLocations, thisWeekReports } = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const total = items.length;
    const resolved = items.filter((i) => i.status === 'resolved').length;

    const uniqueLocations = new Set(
      items
        .map((i) => i.location?.trim())
        .filter((loc): loc is string => Boolean(loc))
    );
    const covered = uniqueLocations.size;

    const thisWeek = items.filter((i) => {
      const createdTime = new Date(i.createdAt).getTime();
      return !isNaN(createdTime) && createdTime >= sevenDaysAgo;
    }).length;

    return {
      totalReports: total,
      resolvedItems: resolved,
      coveredLocations: covered,
      thisWeekReports: thisWeek,
    };
  }, [items]);

  const statItems = [
    {
      key: 'totalReports',
      value: totalReports,
      label: 'البلاغات المنشورة',
    },
    {
      key: 'resolvedItems',
      value: resolvedItems,
      label: 'أغراض رجعت لأصحابها',
    },
    {
      key: 'coveredLocations',
      value: coveredLocations,
      label: 'مواقع مشمولة',
    },
    {
      key: 'thisWeekReports',
      value: thisWeekReports,
      label: 'بلاغات هذا الأسبوع',
    },
  ];

  return (
    <div className="w-full min-w-0">
      {/* Ultra compact for screens under 380px: one horizontally scrollable row of compact pills */}
      <div className="flex sm:hidden max-[379px]:flex hidden overflow-x-auto gap-2 -mx-4 px-4 py-1 scrollbar-none select-none">
        {statItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-2 bg-[#16191F] border border-[rgba(255,255,255,0.08)] rounded-full px-4 py-2 shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          >
            <span
              className="text-[#4D9BFF] font-extrabold text-[16px] font-mono tabular-nums"
              style={{ textShadow: '0 0 16px rgba(77,155,255,0.35)' }}
            >
              {isLoading ? (
                <span className="inline-block h-4 w-8 bg-[rgba(255,255,255,0.1)] rounded animate-pulse" />
              ) : (
                <StatCounter key={item.value} target={item.value} />
              )}
            </span>
            <span className="text-[13px] text-[#B4BECB] whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Main Stat Strip Panel (screens >= 380px):
          Desktop: 4 columns
          Mobile 380px–767px: 2x2 grid, row height ~90px
      */}
      <div className="max-[379px]:hidden bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[20px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-[rgba(255,255,255,0.08)]">
          {statItems.map((item, index) => {
            const isFirstColIn2x2 = index % 2 === 0;

            return (
              <div
                key={item.key}
                className={`min-h-[88px] sm:min-h-[96px] md:min-h-[110px] flex flex-col items-center justify-center text-center px-4 py-3 relative ${
                  /* Desktop divider on right for all except index 0 */
                  index !== 0 ? 'md:border-r md:border-[rgba(255,255,255,0.08)]' : ''
                } ${
                  /* 2x2 mobile divider on right for odd index in RTL */
                  !isFirstColIn2x2 ? 'border-r border-[rgba(255,255,255,0.08)] md:border-r-0' : ''
                }`}
              >
                {/* Number: clamp(28px, 3.4vw, 44px) */}
                <div
                  className="text-[clamp(28px,3.4vw,44px)] font-extrabold text-[#4D9BFF] font-mono tabular-nums leading-none tracking-tight select-none"
                  style={{ textShadow: '0 0 24px rgba(77,155,255,0.35)' }}
                >
                  {isLoading ? (
                    <div className="h-8 sm:h-9 w-16 bg-[rgba(255,255,255,0.08)] rounded-md animate-pulse my-1" />
                  ) : (
                    <StatCounter key={item.value} target={item.value} />
                  )}
                </div>

                {/* Label under it in --text-300 at 14px */}
                <div className="text-[14px] text-[#B4BECB] font-medium mt-1.5 line-clamp-1 leading-normal">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
