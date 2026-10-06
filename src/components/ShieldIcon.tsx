import React from 'react';

interface ShieldIconProps {
  className?: string;
  size?: number;
  variant?: 'solid' | 'outline' | 'spark';
}

export const ShieldIcon: React.FC<ShieldIconProps> = ({
  className = 'w-5 h-5 text-[#2F6BFF]',
  size = 20,
  variant = 'solid',
}) => {
  if (variant === 'spark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M12 2.5C12 2.5 5 4.8 3.5 6C3.5 14 6.5 20.5 12 22.5C17.5 20.5 20.5 14 20.5 6C19 4.8 12 2.5 12 2.5Z"
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2.5" fill="currentColor" />
        <path d="M12 6.5V7.5M12 14.5V15.5M7.5 11H8.5M15.5 11H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === 'outline') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2.5L4.5 5.5v5.5C4.5 16 8 19.8 12 21.5c4-1.7 7.5-5.5 7.5-10.5V5.5L12 2.5z" />
    </svg>
  );
};
