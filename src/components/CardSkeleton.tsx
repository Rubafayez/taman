import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div
      className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[20px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] animate-pulse flex flex-col"
      aria-hidden="true"
    >
      {/* Media Skeleton with consistent 4/3 aspect ratio */}
      <div className="w-full aspect-[4/3] bg-[#16191F] relative shrink-0" />

      {/* Content Skeleton */}
      <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-5 bg-[rgba(255,255,255,0.08)] rounded-md w-3/4" />
          <div className="space-y-1.5 pt-0.5">
            <div className="h-3.5 bg-[rgba(255,255,255,0.05)] rounded-md w-full" />
            <div className="h-3.5 bg-[rgba(255,255,255,0.04)] rounded-md w-4/5" />
          </div>
        </div>
        <div className="h-3.5 bg-[rgba(255,255,255,0.04)] rounded-md w-2/3 pt-1" />
      </div>
    </div>
  );
};
