import React from 'react';
import { Check } from 'lucide-react';
import { toArabicDigits } from '../config/strings.ar';

export type HandoverStep = 1 | 2 | 3 | 4;

interface HandoverStepperProps {
  currentStep: HandoverStep;
  className?: string;
  isResolved?: boolean;
}

const STEPS = [
  { step: 1, label: 'طلب' },
  { step: 2, label: 'مراجعة' },
  { step: 3, label: 'تواصل' },
  { step: 4, label: 'تم' },
] as const;

export const HandoverStepper: React.FC<HandoverStepperProps> = ({
  currentStep,
  className = '',
  isResolved = false,
}) => {
  const effectiveStep = isResolved ? 4 : currentStep;
  const currentStepObj = STEPS.find((s) => s.step === effectiveStep) || STEPS[3];

  return (
    <div className={`w-full min-w-0 py-2.5 ${className}`} dir="rtl">
      <div className="relative flex items-center justify-between w-full min-w-0">
        {/* Connecting line behind icons: bounded strictly to circle centers (16px from start/end) */}
        <div
          className="absolute top-4 left-4 right-4 h-0.5 bg-[rgba(255,255,255,0.08)] -z-0 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[#2F6BFF] transition-all duration-500 ease-out shadow-[0_0_8px_rgba(47,107,255,0.5)]"
            style={{
              width:
                effectiveStep === 1
                  ? '0%'
                  : effectiveStep === 2
                  ? '33.33%'
                  : effectiveStep === 3
                  ? '66.66%'
                  : '100%',
            }}
          />
        </div>

        {STEPS.map((s) => {
          const isCompleted = s.step < effectiveStep || (isResolved && s.step === 4);
          const isCurrent = s.step === effectiveStep && !isResolved;

          return (
            <div
              key={s.step}
              className="relative z-10 flex flex-col items-center select-none min-w-0"
            >
              {/* Step circle indicator: 32x32px (w-8 h-8) */}
              <div className="relative flex items-center justify-center shrink-0">
                {isCurrent && (
                  <span
                    className="absolute -inset-1 rounded-full bg-[#4D9BFF]/30 animate-ping"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.4)]'
                      : isCurrent
                      ? 'bg-[#2F6BFF] text-white ring-4 ring-[#4D9BFF]/25 shadow-[0_0_10px_rgba(47,107,255,0.4)]'
                      : 'bg-[#16191F] border border-[rgba(255,255,255,0.15)] text-[#B4BECB]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  ) : (
                    <span>{toArabicDigits(s.step)}</span>
                  )}
                </div>
              </div>

              {/* Label: 12px, never wraps, hidden on narrow screens < 380px */}
              <span
                className={`mt-1.5 text-[12px] font-medium transition-colors hidden min-[380px]:inline-block whitespace-nowrap text-center ${
                  isCurrent
                    ? 'text-[#4D9BFF] font-bold'
                    : isCompleted
                    ? 'text-[#F2F5F9]'
                    : 'text-[#B4BECB]/60'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Under 380px fallback: single active step label centered under the row */}
      <div className="block min-[380px]:hidden text-center mt-2.5 text-[12px] font-medium text-[#B4BECB]">
        المرحلة: <span className="font-bold text-[#4D9BFF]">{currentStepObj.label}</span>
      </div>
    </div>
  );
};
