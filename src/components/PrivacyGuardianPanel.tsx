import React from 'react';
import { Shield, Check } from 'lucide-react';
import { PrivacyRisk } from '../services/aiService';
import { AiSparkleChip } from './AiSparkleChip';

interface PrivacyGuardianPanelProps {
  risks: PrivacyRisk[];
  appliedIndices: Set<number>;
  ignoredIndices: Set<number>;
  isReviewing?: boolean;
  onRemoveExcerpt: (excerpt: string, riskIndex: number) => void;
  onMoveToVerification: (excerpt: string, riskIndex: number) => void;
  onApplyAll: () => void;
  onIgnoreRisk: (riskIndex: number) => void;
}

export const PrivacyGuardianPanel: React.FC<PrivacyGuardianPanelProps> = ({
  risks,
  appliedIndices,
  ignoredIndices,
  isReviewing = false,
  onRemoveExcerpt,
  onMoveToVerification,
  onApplyAll,
  onIgnoreRisk,
}) => {
  // If reviewing and no risks yet, show subtle inline shimmer
  if (isReviewing && risks.length === 0) {
    return (
      <div className="p-3 rounded-[16px] bg-[#16191F]/70 border border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3 text-[12px] text-[#B4BECB] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-[#FFB84D] animate-pulse shrink-0" aria-hidden="true" />
          <span className="truncate">حارس الخصوصية: جارٍ مراجعة الوصف…</span>
          <AiSparkleChip />
        </div>
        <div className="w-16 sm:w-20 h-1 bg-[#4D9BFF]/20 rounded-full overflow-hidden shrink-0">
          <div className="w-full h-full bg-[#4D9BFF] animate-pulse" />
        </div>
      </div>
    );
  }

  // Active risks that have neither been applied nor ignored
  const activeRisks = risks
    .map((risk, index) => ({ risk, index }))
    .filter(({ index }) => !appliedIndices.has(index) && !ignoredIndices.has(index));

  // If no active risks remain, panel disappears
  if (activeRisks.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="حارس الخصوصية"
      className="p-4 sm:p-5 rounded-[20px] bg-[#101216] border border-[#FFB84D]/30 space-y-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] text-right w-full min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[rgba(255,255,255,0.06)] min-w-0">
        <div className="flex items-center gap-2 font-bold text-[#F2F5F9] min-w-0">
          <Shield className="w-4 h-4 text-[#FFB84D] shrink-0" aria-hidden="true" />
          <span className="text-[14px] sm:text-[15px] truncate">راجع وصفك قبل النشر</span>
          <AiSparkleChip />
        </div>

        <button
          type="button"
          onClick={onApplyAll}
          className="w-full sm:w-auto min-h-[44px] px-4 py-1.5 rounded-full bg-[#2F6BFF] text-white text-[13px] font-bold hover:bg-[#2F6BFF]/90 transition-all cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.25)] select-none shrink-0 inline-flex items-center justify-center gap-1.5"
        >
          <span>طبّق كل الاقتراحات</span>
        </button>
      </div>

      {/* Risk Rows */}
      <div className="space-y-2.5 min-w-0">
        {risks.map((risk, index) => {
          const isApplied = appliedIndices.has(index);
          const isIgnored = ignoredIndices.has(index);

          if (isIgnored) return null;

          if (isApplied) {
            return (
              <div
                key={index}
                className="flex items-center gap-2 text-[12px] text-[#3DDC97] py-1.5 px-3 rounded-xl bg-[#3DDC97]/10 border border-[#3DDC97]/20 transition-all min-w-0"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">تم تعديل: "{risk.excerpt}"</span>
              </div>
            );
          }

          const isMoveToVerification =
            risk.action === 'move_to_verification' || risk.type === 'over_identifying';

          return (
            <div
              key={index}
              className="p-3 rounded-[16px] bg-[#16191F] border border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
            >
              {/* Excerpt + Reason */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[12px] font-mono text-[#F2F5F9] max-w-full truncate block sm:inline-block">
                    "{risk.excerpt}"
                  </span>
                  {risk.severity === 'high' ? (
                    <span className="text-[11px] font-semibold text-[#FFB84D] px-2 py-0.5 rounded-full bg-[#FFB84D]/10 shrink-0">
                      بيانات حساسة
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#4D9BFF] px-2 py-0.5 rounded-full bg-[#4D9BFF]/10 shrink-0">
                      تفصيل مميز
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-[#B4BECB] leading-snug">
                  {risk.message}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-col sm:flex-row w-full sm:w-auto">
                {isMoveToVerification ? (
                  <button
                    type="button"
                    onClick={() => onMoveToVerification(risk.excerpt, index)}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-full bg-[#4D9BFF]/15 border border-[#4D9BFF]/30 text-[#4D9BFF] hover:bg-[#4D9BFF]/25 font-semibold text-[13px] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer select-none"
                  >
                    <span>اجعله سؤال تحقق</span>
                    <AiSparkleChip />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRemoveExcerpt(risk.excerpt, index)}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-full bg-[#16191F] border border-[#4D9BFF]/40 text-[#4D9BFF] hover:border-[#4D9BFF] hover:bg-[#4D9BFF]/10 font-semibold text-[13px] transition-all cursor-pointer select-none text-center"
                  >
                    احذفه من الوصف
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onIgnoreRisk(index)}
                  className="w-full sm:w-auto min-h-[44px] px-2.5 text-[12px] text-[#B4BECB]/70 hover:text-[#B4BECB] underline cursor-pointer transition-colors text-center inline-flex items-center justify-center"
                >
                  تجاهل
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
