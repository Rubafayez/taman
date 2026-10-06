import React, { useState, useEffect } from 'react';
import { AiSparkleChip } from './AiSparkleChip';

interface MatchReasonChipProps {
  reason: string;
}

export const MatchReasonChip: React.FC<MatchReasonChipProps> = ({ reason }) => {
  const isSemantic = reason.includes('تشابه في الوصف') || reason.includes('✨');
  const [expanded, setExpanded] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  useEffect(() => {
    if (isSemantic) {
      try {
        const hasPulsed = localStorage.getItem('taman:seen_semantic_match_pulse');
        if (!hasPulsed) {
          setShouldPulse(true);
          localStorage.setItem('taman:seen_semantic_match_pulse', 'true');
          const timer = setTimeout(() => {
            setShouldPulse(false);
          }, 4500);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.warn('Storage error for semantic pulse:', err);
      }
    }
  }, [isSemantic]);

  if (!isSemantic) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[11px] sm:text-[12px] text-[#4D9BFF] shrink-0">
        {reason}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 max-w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        aria-expanded={expanded}
        className={`px-2.5 py-0.5 rounded-full bg-[#101216] border border-[#4D9BFF]/40 text-[11px] sm:text-[12px] text-[#4D9BFF] hover:border-[#4D9BFF] hover:bg-[#4D9BFF]/10 transition-all inline-flex items-center gap-1.5 cursor-pointer select-none shrink-0 ${
          shouldPulse ? 'animate-pulse ring-2 ring-[#4D9BFF]/50 ring-offset-1 ring-offset-[#101216]' : ''
        }`}
      >
        <span>تشابه في الوصف</span>
        <AiSparkleChip pulse={shouldPulse} />
      </button>

      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="text-[12px] text-[#B4BECB] bg-[#101216] border border-[#4D9BFF]/30 px-2.5 py-1.5 rounded-[10px] select-text leading-relaxed"
        >
          قارنّا معنى الوصفين، مو الكلمات نفسها.
        </div>
      )}
    </div>
  );
};
