import React from 'react';

interface LogoProps {
  variant?: 'header' | 'footer';
  isScrolled?: boolean;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'header',
  isScrolled = false,
  onClick,
}) => {
  // Height sizing:
  // Header: clamp(34px, 3.4vw, 48px)
  // Footer: clamp(30px, 3vw, 40px)
  const isHeader = variant === 'header';
  const logoHeightClass = isHeader
    ? 'h-[clamp(34px,3.4vw,48px)]'
    : 'h-[clamp(30px,3vw,40px)]';

  const wordmarkSizeClass = isHeader
    ? 'text-[clamp(22px,2.2vw,30px)]'
    : 'text-[clamp(19px,1.9vw,25px)]';

  const content = (
    <div
      className={`flex items-center gap-2.5 sm:gap-3 bg-transparent transition-all duration-200 ease-out motion-reduce:transition-none ${
        isScrolled && isHeader ? 'scale-[0.82] origin-right rtl:origin-right ltr:origin-left' : 'scale-100'
      }`}
    >
      {/* 
        Inline SVG Shield Mark:
        Transparent background directly on navy.
        Shield in --blue-400 (#2E7FD4) with white inner stroke and white central lock.
        No part of the mark is navy-on-navy.
      */}
      <div className={`shrink-0 ${logoHeightClass} aspect-[44/48] flex items-center justify-center`}>
        <svg
          viewBox="0 0 44 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Outer shield mark in --blue-400 (#4D9BFF) */}
          <path
            d="M22 2L4 9.5V23.5C4 35.8 22 46 22 46C22 46 40 35.8 40 23.5V9.5L22 2Z"
            fill="#4D9BFF"
          />
          {/* White inner stroke with gentle opacity */}
          <path
            d="M22 6L8 12.5V23.5C8 33.5 22 42 22 42C22 42 36 33.5 36 23.5V12.5L22 6Z"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="none"
            opacity="0.95"
          />
          {/* Center lock emblem in pure white */}
          <path
            d="M22 17C20.1 17 18.5 18.6 18.5 20.5V23H17.5C16.7 23 16 23.7 16 24.5V32.5C16 33.3 16.7 34 17.5 34H26.5C27.3 34 28 33.3 28 32.5V24.5C28 23.7 27.3 23 26.5 23H25.5V20.5C25.5 18.6 23.9 17 22 17ZM22 19.2C22.7 19.2 23.3 19.8 23.3 20.5V23H20.7V20.5C20.7 19.8 21.3 19.2 22 19.2Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* "تأمن" wordmark in pure white */}
      <span
        className={`font-black text-white tracking-tight leading-none select-none ${wordmarkSizeClass}`}
        style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
      >
        تأمن
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="تأمن — الصفحة الرئيسية"
        className="flex items-center bg-transparent p-0 m-0 border-0 cursor-pointer transition-opacity duration-200 hover:opacity-85 active:opacity-75 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-lg shrink-0"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center bg-transparent p-0 m-0 border-0 shrink-0">
      {content}
    </div>
  );
};
