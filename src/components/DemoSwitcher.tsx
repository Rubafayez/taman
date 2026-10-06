import React, { useState, useEffect, useRef } from 'react';
import { DEMO_PERSONAS, DemoPersona } from '../services/demoService';
import { Check, LogOut } from 'lucide-react';

interface DemoSwitcherProps {
  activePersona: DemoPersona | null;
  isModalOpen: boolean;
  onSelectPersona: (persona: DemoPersona) => void;
  onExitDemo: () => void;
}

export const DemoSwitcher: React.FC<DemoSwitcherProps> = ({
  activePersona,
  isModalOpen,
  onSelectPersona,
  onExitDemo,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInlineConfirm, setHasInlineConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if any modal or inline confirm state is open anywhere on the page
  useEffect(() => {
    const checkInlineConfirm = () => {
      const exists = Boolean(
        document.querySelector('[data-inline-confirm="true"]') ||
        document.querySelector('[data-confirm-state="true"]') ||
        document.querySelector('[data-cancel-claim-slot] [role="status"]') ||
        document.querySelector('[data-delete-confirm-slot] [role="status"]')
      );
      setHasInlineConfirm(exists);
    };

    checkInlineConfirm();

    const observer = new MutationObserver(() => {
      checkInlineConfirm();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-inline-confirm', 'data-confirm-state', 'role'],
    });

    return () => observer.disconnect();
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Hidden while a modal or an inline confirm state is open
  if (isModalOpen || hasInlineConfirm) {
    return null;
  }

  const currentLabel = activePersona ? activePersona.name : 'طالب ١';

  return (
    <div
      ref={containerRef}
      className="fixed start-4 bottom-20 sm:bottom-6 z-40 select-none print:hidden"
    >
      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="قائمة وضع العرض"
          className="absolute bottom-full mb-2 start-0 w-48 rounded-[16px] bg-[#16191F] border border-[rgba(255,255,255,0.12)] shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-1.5 space-y-1 text-right text-[13px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {DEMO_PERSONAS.map((persona) => {
            const isSelected = activePersona?.id === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSelectPersona(persona);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] transition-colors cursor-pointer text-start ${
                  isSelected
                    ? 'bg-[#1F2633] text-[#4D9BFF] font-bold'
                    : 'text-[#F2F5F9] hover:bg-[rgba(255,255,255,0.06)]'
                }`}
              >
                <span>{persona.name}</span>
                {isSelected && <Check className="w-4 h-4 text-[#4D9BFF] shrink-0" />}
              </button>
            );
          })}

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-1" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onExitDemo();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-[12px] text-[#B4BECB] hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 transition-colors cursor-pointer text-start"
          >
            <span>الخروج من وضع العرض</span>
            <LogOut className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>
        </div>
      )}

      {/* Floating Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.12)] hover:border-[#4D9BFF]/40 text-[13px] font-medium text-[#F2F5F9] shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center gap-1.5 backdrop-blur-md hover:bg-[#1F2633] transition-all cursor-pointer active:scale-95"
      >
        <span>وضع العرض: {currentLabel} ▾</span>
      </button>
    </div>
  );
};
