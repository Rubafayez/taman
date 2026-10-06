import React from 'react';

interface AiSparkleChipProps {
  className?: string;
  pulse?: boolean;
}

export const AiSparkleChip: React.FC<AiSparkleChipProps> = ({
  className = '',
  pulse = false,
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center font-normal px-1.5 py-0.5 rounded text-[11px] bg-[#4D9BFF]/15 text-[#4D9BFF] border border-[#4D9BFF]/30 select-none ${
        pulse ? 'animate-pulse ring-2 ring-[#4D9BFF]/50 ring-offset-1 ring-offset-[#101216]' : ''
      } ${className}`}
      aria-label="ميزة ذكاء اصطناعي"
    >
      ✨
    </span>
  );
};
