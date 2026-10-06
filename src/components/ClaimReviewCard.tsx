import React, { useState, useEffect } from 'react';
import { ClaimRequest } from '../types';
import { formatDate } from '../utils/date';
import { toArabicDigits } from '../config/strings.ar';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export const REJECTION_REASONS = [
  'الإجابة غير صحيحة',
  'بيانات غير كافية',
  'سبب آخر',
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];

interface ClaimReviewCardProps {
  claim: ClaimRequest;
  itemId: string;
  itemDescription: string;
  verificationQuestion?: string;
  isEvaluating?: boolean;
  evaluatedConfidence?: number;
  evaluatedAssessment?: string;
  onApprove: (itemId: string, claimId: string) => void;
  onReject: (itemId: string, claimId: string, reason?: string) => void;
  isRejectConfirming?: boolean;
  onStartRejectConfirm?: (claimId: string) => void;
  onCancelRejectConfirm?: () => void;
}

export const ClaimReviewCard: React.FC<ClaimReviewCardProps> = ({
  claim,
  itemId,
  isEvaluating = false,
  evaluatedConfidence,
  evaluatedAssessment,
  onApprove,
  onReject,
  isRejectConfirming = false,
  onStartRejectConfirm,
  onCancelRejectConfirm,
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [showConfidenceExplainer, setShowConfidenceExplainer] = useState(false);

  // Reset selected reason when confirm mode closes
  useEffect(() => {
    if (!isRejectConfirming) {
      setSelectedReason(null);
    }
  }, [isRejectConfirming]);

  // Escape key handler to cancel rejection confirm
  useEffect(() => {
    if (!isRejectConfirming) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedReason(null);
        onCancelRejectConfirm?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRejectConfirming, onCancelRejectConfirm]);

  const displayConfidence =
    evaluatedConfidence !== undefined
      ? evaluatedConfidence
      : claim.answerConfidence !== null && claim.answerConfidence !== undefined
      ? Number(claim.answerConfidence)
      : undefined;

  const displayAssessment =
    evaluatedAssessment !== undefined ? evaluatedAssessment : claim.answerAssessment;

  const hasConfidence = displayConfidence !== undefined && displayConfidence !== null;
  const isHigh = hasConfidence && displayConfidence >= 70;
  const isMedium = hasConfidence && displayConfidence >= 40 && displayConfidence < 70;

  const indicatorLabel = isHigh
    ? 'مؤشر استرشادي: تطابق مرتفع'
    : isMedium
    ? 'مؤشر استرشادي: تطابق متوسط'
    : 'مؤشر استرشادي: تطابق منخفض';

  return (
    <div className="p-4 rounded-[16px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-3.5 text-[13px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      {/* 1. Claimant name and date */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[#F2F5F9] text-[14px]">
          {claim.claimantName}
        </span>
        <span className="font-mono text-[#B4BECB] text-[12px]">
          {formatDate(claim.submittedAt)}
        </span>
      </div>

      {/* 2. Claimant answer */}
      {claim.answerProvided && (
        <div className="bg-[#101216] p-3 rounded-[10px] border border-[rgba(255,255,255,0.05)] space-y-1">
          <span className="text-[11px] font-semibold text-[#B4BECB] block">
            إجابة التحقق المقدمة:
          </span>
          <p className="text-[#F2F5F9] leading-relaxed select-text">
            "{claim.answerProvided}"
          </p>
        </div>
      )}

      {/* 3. While evaluating: Independent Shimmer line with "جارٍ التقييم…" */}
      {isEvaluating && (
        <div className="p-3 rounded-[10px] bg-[#101216] border border-[#4D9BFF]/30 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[12px] text-[#4D9BFF]">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>جارٍ التقييم…</span>
            </span>
            <span className="text-[11px] text-[#B4BECB]">تحليل ذكي للإجابة</span>
          </div>
          <div className="w-full h-1.5 bg-[#16191F] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#4D9BFF]/20 via-[#4D9BFF] to-[#4D9BFF]/20 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* 4. Evaluated hint:
          - The confidence bar must not be green. Use --blue-400 (#4D9BFF) for the fill at EVERY level.
          - Level expressed through label (تطابق مرتفع / متوسط / منخفض) plus percentage.
          - Green stays reserved for "تم التسليم" status badge only. */}
      {!isEvaluating && hasConfidence && (
        <div className="p-3 rounded-[12px] bg-[#101216] border border-[rgba(255,255,255,0.08)] space-y-2.5 text-right">
          {/* Thin horizontal bar filled to confidence percentage using --blue-400 */}
          <div className="w-full h-1.5 bg-[#16191F] rounded-full overflow-hidden border border-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-700 bg-[#4D9BFF]"
              style={{ width: `${Math.max(5, Math.min(100, displayConfidence!))}%` }}
            />
          </div>

          {/* Label and percentage badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-[12px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 font-bold text-[#F2F5F9]">
                <Sparkles className="w-3.5 h-3.5 text-[#4D9BFF]" />
                <span>{indicatorLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowConfidenceExplainer((prev) => !prev)}
                className="text-[11px] text-[#4D9BFF] hover:underline cursor-pointer transition-colors"
                aria-expanded={showConfidenceExplainer}
              >
                كيف يُحسب؟
              </button>
            </div>
            <span className="px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[#4D9BFF]/15 text-[#4D9BFF] border border-[#4D9BFF]/30">
              {toArabicDigits(displayConfidence!)}%
            </span>
          </div>

          {showConfidenceExplainer && (
            <p className="text-[12px] text-[#B4BECB] bg-[#16191F] border border-[rgba(255,255,255,0.06)] px-2.5 py-1.5 rounded-[8px] leading-relaxed">
              نقارن إجابة التحقق بوصف الغرض ونعطيك مؤشراً استرشادياً. القرار لك.
            </p>
          )}

          {/* One-line Arabic assessment */}
          {displayAssessment && (
            <p className="text-[12px] text-[#B4BECB] leading-relaxed">
              {displayAssessment}
            </p>
          )}

          {/* Fixed note in --text-300 */}
          <p className="text-[11px] text-[#B4BECB] pt-1 border-t border-[rgba(255,255,255,0.04)]">
            القرار النهائي لك — هذا مؤشر مساعد فقط.
          </p>
        </div>
      )}

      {/* 5. Required confirmation checkbox before approval */}
      {!isRejectConfirming && (
        <label className="flex items-start gap-2.5 pt-1 text-[13px] text-[#F2F5F9] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[rgba(255,255,255,0.2)] bg-[#101216] text-[#2F6BFF] focus:ring-[#4D9BFF] focus:ring-offset-0 cursor-pointer shrink-0"
          />
          <span className="leading-snug text-[#B4BECB] hover:text-[#F2F5F9] transition-colors">
            راجعت إجابة التحقق وأنا مقتنع بأن هذا هو صاحب الغرض
          </span>
        </label>
      )}

      {/* 6. Action Row with reserved height and 150ms cross-fade */}
      <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] min-h-[50px] flex items-center">
        {isRejectConfirming ? (
          /* Inline Confirmation Mode:
             «سبب الرفض؟» + three compact chips + «تأكيد الرفض» + «تراجع» */
          <div data-inline-confirm="true" className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-opacity duration-150 ease-in-out">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-bold text-[#FF6B7A] shrink-0">
                سبب الرفض؟
              </span>
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer select-none ${
                    selectedReason === reason
                      ? 'bg-[#FF6B7A] text-white shadow-[0_1px_6px_rgba(255,107,122,0.35)] ring-1 ring-[#FF6B7A]'
                      : 'bg-[#101216] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)] hover:border-[#FF6B7A]/40'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                type="button"
                disabled={!selectedReason}
                onClick={() => {
                  if (selectedReason) {
                    onReject(itemId, claim.id, selectedReason);
                    onCancelRejectConfirm?.();
                  }
                }}
                className={`min-h-[34px] px-3.5 py-1 rounded-full font-bold text-[12px] transition-all flex items-center gap-1 ${
                  selectedReason
                    ? 'bg-[#FF6B7A] text-white hover:bg-[#FF6B7A]/90 cursor-pointer shadow-[0_2px_8px_rgba(255,107,122,0.3)] active:scale-95'
                    : 'bg-[#FF6B7A]/25 text-white/40 cursor-not-allowed border border-[rgba(255,255,255,0.06)]'
                }`}
              >
                تأكيد الرفض
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedReason(null);
                  onCancelRejectConfirm?.();
                }}
                className="min-h-[34px] px-3 py-1 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.12)] text-[12px] font-medium transition-all cursor-pointer hover:bg-[rgba(255,255,255,0.05)] active:scale-95"
              >
                تراجع
              </button>
            </div>
          </div>
        ) : (
          /* Normal Action Row:
             - «قبول الطلب» uses primary blue fill (--blue-600 = #2F6BFF), never green!
             - «رفض» stays a quiet outline button */
          <div className="w-full flex items-center justify-end gap-2 transition-opacity duration-150 ease-in-out">
            <button
              type="button"
              disabled={!isConfirmed}
              onClick={() => onApprove(itemId, claim.id)}
              className={`min-h-[36px] px-4 py-1.5 rounded-full font-bold text-[13px] transition-all flex items-center gap-1.5 ${
                isConfirmed
                  ? 'bg-[#2F6BFF] text-white hover:bg-[#2558D4] cursor-pointer shadow-[0_2px_10px_rgba(47,107,255,0.3)] active:scale-95'
                  : 'bg-[#2F6BFF]/30 text-white/40 cursor-not-allowed border border-[rgba(255,255,255,0.06)]'
              }`}
              title={
                !isConfirmed
                  ? 'يرجى تأكيد مراجعة إجابة التحقق لتفعيل زر القبول'
                  : undefined
              }
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>قبول الطلب</span>
            </button>

            <button
              type="button"
              onClick={() => onStartRejectConfirm?.(claim.id)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-full text-[#B4BECB] hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 border border-[rgba(255,255,255,0.12)] hover:border-[#FF6B7A]/40 text-[12px] font-medium transition-all cursor-pointer active:scale-95"
            >
              رفض
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
