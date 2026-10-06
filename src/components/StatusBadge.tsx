import React from 'react';
import { ItemType, ItemStatus } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  type: ItemType;
  status: ItemStatus;
  className?: string;
  animateResolved?: boolean;
  grayResolved?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  status,
  className = '',
  animateResolved = false,
}) => {
  // Badges are pill-shaped, 13px, colored text on a 12%-opacity fill of the same hue, no borders.
  if (status === 'resolved') {
    return (
      <motion.span
        initial={animateResolved ? { scale: 0.9 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#3DDC97]/12 text-[#3DDC97] select-none ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-[#3DDC97] shrink-0" aria-hidden="true" />
        <span>تم التسليم</span>
      </motion.span>
    );
  }

  if (type === 'found') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#4D9BFF]/12 text-[#4D9BFF] select-none ${className}`}
      >
        <Sparkles className="w-3.5 h-3.5 text-[#4D9BFF] shrink-0" aria-hidden="true" />
        <span>موجود</span>
      </span>
    );
  }

  // type === 'lost' -> Amber badge
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold bg-[#FFB84D]/12 text-[#FFB84D] select-none ${className}`}
    >
      <Clock className="w-3.5 h-3.5 text-[#FFB84D] shrink-0" aria-hidden="true" />
      <span>مفقود</span>
    </span>
  );
};
