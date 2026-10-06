import React from 'react';
import { motion } from 'motion/react';

interface MorphingResolvedBadgeProps {
  isResolved: boolean;
  size?: number;
  className?: string;
}

export const MorphingResolvedBadge: React.FC<MorphingResolvedBadgeProps> = ({
  isResolved,
  size = 48,
  className = '',
}) => {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full p-2 transition-all select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background circle transitioning from blue-400/12 to emerald-400/12 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        initial={false}
        animate={{
          backgroundColor: isResolved ? 'rgba(61, 220, 151, 0.12)' : 'rgba(77, 155, 255, 0.12)',
        }}
        transition={{ duration: 0.35 }}
      />

      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Shield outline path */}
        <motion.path
          d="M12 2L4 5V11C4 16.5 7.5 21 12 22C16.5 21 20 16.5 20 11V5L12 2Z"
          stroke={isResolved ? '#3DDC97' : '#4D9BFF'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{
            stroke: isResolved ? '#3DDC97' : '#4D9BFF',
            opacity: isResolved ? 0.3 : 1,
            scale: isResolved ? 0.9 : 1,
          }}
          transition={{ duration: 0.35 }}
        />

        {/* Checkmark drawing in when resolved */}
        {isResolved ? (
          <motion.path
            d="M7 12.5L10.5 16L17 8.5"
            stroke="#3DDC97"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        ) : (
          <motion.path
            d="M12 8V12M12 16H12.01"
            stroke="#4D9BFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </svg>
    </div>
  );
};
