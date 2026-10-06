import React from 'react';
import { STRINGS_AR } from '../config/strings.ar';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#101216] text-[#F2F5F9] border-t border-[rgba(255,255,255,0.08)] mt-auto mb-16 md:mb-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="app-container py-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center text-[13px] sm:text-[14px] text-[#B4BECB] min-w-0">
        <span>{STRINGS_AR.brand.copyright(new Date().getFullYear())}</span>
        <span className="text-[rgba(255,255,255,0.2)]">·</span>
        <div className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#4D9BFF] shrink-0" aria-hidden="true" />
          <span>{STRINGS_AR.brand.privacyFooterNote}</span>
        </div>
      </div>
    </footer>
  );
};
