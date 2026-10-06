import React, { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { ScreenType } from '../types';
import { Home, PlusCircle, BookmarkCheck } from 'lucide-react';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  myItemsCount?: number;
  pendingClaimsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  myItemsCount = 0,
  pendingClaimsCount = 0,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      {/* Top Header: Sticky dark bar (--bg-900 #101216) with --line border */}
      <header
        className={`sticky top-0 z-40 w-full bg-[#101216]/95 backdrop-blur-md text-[#F2F5F9] border-b border-[rgba(255,255,255,0.08)] transition-all duration-200 ease-out motion-reduce:transition-none ${
          isScrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.5)]' : ''
        }`}
      >
        <div
          className={`app-container flex items-center justify-between w-full min-w-0 transition-all duration-200 ease-out motion-reduce:transition-none ${
            isScrolled ? 'h-[56px]' : 'h-[clamp(64px,9vh,84px)]'
          }`}
        >
          {/* Logo on the START (right side in RTL) */}
          <div className="flex items-center shrink-0">
            <Logo
              variant="header"
              isScrolled={isScrolled}
              onClick={() => onNavigate('feed')}
            />
          </div>

          {/* Desktop Navigation:
              Active: filled --blue-600 pill.
              Inactive: --text-300 (#B4BECB), no box.
          */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center shrink-0 gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={() => onNavigate('feed')}
              aria-current={currentScreen === 'feed' ? 'page' : undefined}
              className={`min-h-[44px] px-5 py-2 rounded-full text-[15px] font-medium transition-all flex items-center gap-2 cursor-pointer ${
                currentScreen === 'feed'
                  ? 'bg-[#2F6BFF] text-white font-semibold shadow-[0_0_16px_rgba(47,107,255,0.35)]'
                  : 'text-[#B4BECB] hover:text-[#F2F5F9]'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>الرئيسية</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('post')}
              aria-current={currentScreen === 'post' ? 'page' : undefined}
              className={`min-h-[44px] px-5 py-2 rounded-full text-[15px] font-medium transition-all flex items-center gap-2 cursor-pointer ${
                currentScreen === 'post'
                  ? 'bg-[#2F6BFF] text-white font-semibold shadow-[0_0_16px_rgba(47,107,255,0.35)]'
                  : 'text-[#B4BECB] hover:text-[#F2F5F9]'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">إضافة بلاغ</span>
              <span className="inline lg:hidden">إضافة</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('my-items')}
              aria-current={currentScreen === 'my-items' ? 'page' : undefined}
              className={`min-h-[44px] px-5 py-2 rounded-full text-[15px] font-medium transition-all flex items-center gap-2 relative cursor-pointer ${
                currentScreen === 'my-items'
                  ? 'bg-[#2F6BFF] text-white font-semibold shadow-[0_0_16px_rgba(47,107,255,0.35)]'
                  : 'text-[#B4BECB] hover:text-[#F2F5F9]'
              }`}
            >
              <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>بلاغاتي</span>
              {myItemsCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[12px] font-bold rounded-full bg-[#4D9BFF] text-[#0A0B0D] ring-2 ring-[#101216]">
                  {myItemsCount}
                </span>
              )}
              {pendingClaimsCount > 0 && (
                <span
                  title={`${pendingClaimsCount} طلب استرداد بانتظارك`}
                  className="w-2.5 h-2.5 rounded-full bg-[#FFB84D] animate-pulse ring-2 ring-[#101216]"
                />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Fixed on mobile <768px, hamburger-free) */}
      <nav
        aria-label="شريط التنقل السفلي"
        className="fixed bottom-0 left-0 right-0 z-40 w-full max-w-full bg-[#101216]/95 backdrop-blur-md text-[#F2F5F9] border-t border-[rgba(255,255,255,0.08)] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)] h-16 flex items-center justify-around px-2 pb-safe"
      >
        <button
          type="button"
          onClick={() => onNavigate('feed')}
          aria-current={currentScreen === 'feed' ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] py-1 text-[13px] transition-colors cursor-pointer ${
            currentScreen === 'feed'
              ? 'text-white font-bold'
              : 'text-[#B4BECB] hover:text-[#F2F5F9]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              currentScreen === 'feed' ? 'bg-[#2F6BFF] text-white shadow-[0_0_12px_rgba(47,107,255,0.4)]' : ''
            }`}
          >
            <Home className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="mt-0.5">الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('post')}
          aria-current={currentScreen === 'post' ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] py-1 text-[13px] transition-colors cursor-pointer ${
            currentScreen === 'post'
              ? 'text-white font-bold'
              : 'text-[#B4BECB] hover:text-[#F2F5F9]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              currentScreen === 'post' ? 'bg-[#2F6BFF] text-white shadow-[0_0_12px_rgba(47,107,255,0.4)]' : ''
            }`}
          >
            <PlusCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="mt-0.5">إضافة بلاغ</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('my-items')}
          aria-current={currentScreen === 'my-items' ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center h-full min-h-[44px] py-1 text-[13px] transition-colors relative cursor-pointer ${
            currentScreen === 'my-items'
              ? 'text-white font-bold'
              : 'text-[#B4BECB] hover:text-[#F2F5F9]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full relative ${
              currentScreen === 'my-items' ? 'bg-[#2F6BFF] text-white shadow-[0_0_12px_rgba(47,107,255,0.4)]' : ''
            }`}
          >
            <BookmarkCheck className="w-5 h-5" aria-hidden="true" />
            {myItemsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#4D9BFF] text-[#0A0B0D] ring-1 ring-[#101216]">
                {myItemsCount}
              </span>
            )}
          </div>
          <span className="mt-0.5">بلاغاتي</span>
        </button>
      </nav>
    </>
  );
};
