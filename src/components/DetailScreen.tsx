import React, { useMemo, useState, useEffect } from 'react';
import { CampusItem, AutoMatchResult } from '../types';
import { StatusBadge } from './StatusBadge';
import { MatchScoreRing } from './MatchScoreRing';
import { HandoverStepper, HandoverStep } from './HandoverStepper';
import { MorphingResolvedBadge } from './MorphingResolvedBadge';
import { ClaimReviewCard } from './ClaimReviewCard';
import { MatchReasonChip } from './MatchReasonChip';
import { findAutoMatches, isMyItemReport } from '../utils/matching';
import { renderBdi } from '../utils/text';
import { formatDate } from '../utils/date';
import { getDeviceId, getMyClaimIds, itemsService } from '../services/itemsService';
import { aiService } from '../services/aiService';
import {
  MapPin,
  Calendar,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Phone,
  Clock,
  KeyRound,
  ChevronLeft,
  Edit3,
  Trash2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { STRINGS_AR, toArabicDigits } from '../config/strings.ar';
import { CATEGORIES } from '../config/constants';

interface DetailScreenProps {
  item: CampusItem | null;
  allItems: CampusItem[];
  onOpenClaim: (item: CampusItem) => void;
  onSelectItem: (item: CampusItem) => void;
  onNavigateToFeed: () => void;
  onNavigateToMyClaims?: () => void;
  onEditItem: (item: CampusItem) => void;
  onDeleteItem: (itemId: string) => void;
  onMarkResolved: (itemId: string) => void;
  onCancelClaim?: (claimId: string) => Promise<void>;
  onApproveClaim?: (itemId: string, claimId: string) => void;
  onRejectClaim?: (itemId: string, claimId: string, reason?: string) => void;
}

export const DetailScreen: React.FC<DetailScreenProps> = ({
  item,
  allItems,
  onOpenClaim,
  onSelectItem,
  onNavigateToFeed,
  onNavigateToMyClaims,
  onEditItem,
  onDeleteItem,
  onMarkResolved,
  onCancelClaim,
  onApproveClaim,
  onRejectClaim,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCancelClaim, setConfirmingCancelClaim] = useState(false);
  const [isCancellingClaim, setIsCancellingClaim] = useState(false);
  const [blockedDeleteTooltip, setBlockedDeleteTooltip] = useState(false);

  // States for parallel claim evaluation and inline rejection confirmation
  const [evaluatingClaimsMap, setEvaluatingClaimsMap] = useState<Record<string, boolean>>({});
  const [evaluatedClaimsData, setEvaluatedClaimsData] = useState<
    Record<string, { confidence: number; assessment: string }>
  >({});
  const [confirmingRejectClaimId, setConfirmingRejectClaimId] = useState<string | null>(null);

  const currentItem = item || allItems.find((i) => i.status === 'active') || allItems[0];

  // Device ID & Local Claim IDs
  const myDeviceId = getDeviceId();
  const myClaimIds = useMemo(() => getMyClaimIds(), [currentItem, myDeviceId]);

  // Compute State Machine variables from already loaded claims
  const isOwner = Boolean(
    currentItem?.isMyItem ||
      (currentItem as any)?.owner_device_id === myDeviceId ||
      (currentItem as any)?.creator_device_id === myDeviceId
  );

  const isResolved = currentItem?.status === 'resolved';

  // Auto-matches with scoring (Hybrid Rule-based + Semantic)
  // Never show matches for an item that is already resolved.
  const baseMatches = useMemo(() => {
    if (!currentItem || isResolved) return [];
    return findAutoMatches(currentItem, allItems);
  }, [currentItem, allItems, isResolved]);

  const [hybridMatches, setHybridMatches] = useState<AutoMatchResult[] | null>(null);

  useEffect(() => {
    if (!currentItem || isResolved) {
      setHybridMatches([]);
      return;
    }
    let isCancelled = false;
    aiService
      .findHybridMatches(currentItem, allItems)
      .then((res) => {
        if (!isCancelled) {
          setHybridMatches(res);
        }
      })
      .catch((err) => {
        console.warn('Hybrid matches non-blocking error:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [currentItem, allItems, isResolved]);

  const matches = isResolved ? [] : (hybridMatches !== null ? hybridMatches : baseMatches);

  const categoryLabel = useMemo(() => {
    if (!currentItem) return '';
    const found = CATEGORIES.find((c) => c.id === currentItem.category);
    return found ? found.labelAr : currentItem.category;
  }, [currentItem]);

  const myClaim = useMemo(() => {
    if (!currentItem?.claims || currentItem.claims.length === 0) return null;
    return (
      currentItem.claims.find(
        (c) =>
          (c.claimantDeviceId && c.claimantDeviceId === myDeviceId) ||
          myClaimIds.includes(c.id)
      ) || null
    );
  }, [currentItem?.claims, myDeviceId, myClaimIds]);

  const hasOtherPendingOrApprovedClaim = useMemo(() => {
    if (!currentItem?.claims || currentItem.claims.length === 0) return false;
    return currentItem.claims.some(
      (c) =>
        (!myClaim || c.id !== myClaim.id) &&
        (c.status === 'pending' || c.status === 'approved')
    );
  }, [currentItem?.claims, myClaim]);

  const pendingClaims = useMemo(
    () => currentItem?.claims?.filter((c) => c.status === 'pending') || [],
    [currentItem?.claims]
  );
  const approvedClaim = useMemo(
    () => currentItem?.claims?.find((c) => c.status === 'approved'),
    [currentItem?.claims]
  );

  // Parallel evaluation for ALL pending claims on this report using Promise.allSettled
  useEffect(() => {
    if (!isOwner || !currentItem || isResolved) return;
    const unassessedClaims = pendingClaims
      .filter(
        (c) =>
          Boolean(c.answerProvided) &&
          (c.answerConfidence === undefined || c.answerConfidence === null) &&
          !evaluatedClaimsData[c.id] &&
          !itemsService.isClaimEvaluatedOrEvaluating(c.id)
      )
      .slice(0, 5); // Raised per-load cap from 3 to 5

    if (unassessedClaims.length === 0) return;

    // Immediately mark all unassessed claims as evaluating in parallel so each shows its own shimmer
    setEvaluatingClaimsMap((prev) => {
      const next = { ...prev };
      unassessedClaims.forEach((c) => {
        next[c.id] = true;
        itemsService.markClaimAsEvaluating(c.id);
      });
      return next;
    });

    // Run them in parallel with Promise.allSettled so one failure never blocks the others
    Promise.allSettled(
      unassessedClaims.map(async (claim) => {
        try {
          const result = await itemsService.evaluateClaimAnswer(
            claim.id,
            currentItem.description,
            currentItem.verificationQuestion || '',
            claim.answerProvided!
          );
          if (result) {
            setEvaluatedClaimsData((prev) => ({
              ...prev,
              [claim.id]: result,
            }));
            if (currentItem.claims) {
              const target = currentItem.claims.find((c) => c.id === claim.id);
              if (target) {
                target.answerConfidence = result.confidence;
                target.answerAssessment = result.assessment;
              }
            }
          }
        } finally {
          setEvaluatingClaimsMap((prev) => ({
            ...prev,
            [claim.id]: false,
          }));
        }
      })
    );
  }, [pendingClaims, currentItem?.description, currentItem?.verificationQuestion, isOwner, isResolved]);

  if (!currentItem) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-[#101216] rounded-[24px] p-8 border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        <h2 className="text-[20px] font-bold text-[#F2F5F9] mb-2">
          {STRINGS_AR.detail.emptyItemTitle}
        </h2>
        <p className="text-[15px] text-[#B4BECB] mb-6">
          {STRINGS_AR.detail.emptyItemDesc}
        </p>
        <button
          type="button"
          onClick={onNavigateToFeed}
          className="min-h-[48px] px-8 py-2.5 rounded-full bg-[#2F6BFF] text-white text-[15px] font-semibold hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)]"
        >
          {STRINGS_AR.detail.goToHome}
        </button>
      </div>
    );
  }

  // Compute current handover step (1 to 4)
  const handoverStep: HandoverStep = isResolved
    ? 4
    : approvedClaim || currentItem.claimedBy
    ? 3
    : pendingClaims.length > 0
    ? 2
    : 1;

  const handleCancelClaimAction = async () => {
    if (!myClaim) return;
    setIsCancellingClaim(true);
    try {
      if (onCancelClaim) {
        await onCancelClaim(myClaim.id);
      } else {
        await itemsService.cancelClaim(myClaim.id);
      }
    } finally {
      setIsCancellingClaim(false);
      setConfirmingCancelClaim(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-2xl mx-auto space-y-6 text-right w-full min-w-0"
    >
      {/* Back button & Page title */}
      <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)] min-w-0 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateToFeed}
            aria-label={STRINGS_AR.detail.backAria}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#16191F] text-[#F2F5F9] hover:bg-[#16191F] hover:border-[#4D9BFF] transition-colors focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer shrink-0"
          >
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-[24px] sm:text-[26px] font-bold text-[#F2F5F9]">
              {STRINGS_AR.detail.title}
            </h1>
            <p className="text-[14px] text-[#B4BECB]">
              {STRINGS_AR.detail.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Main Item Card */}
      <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        {/* Header: Status Badge + Category */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge
              type={currentItem.type}
              status={currentItem.status}
              animateResolved={isResolved}
            />
            {isOwner && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#101216]/90 border border-[#4D9BFF]/40 text-[#4D9BFF] text-[11px] font-bold">
                بلاغي
              </span>
            )}
            {currentItem.aiGenerated && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#16191F] border border-[#4D9BFF]/30 text-[#4D9BFF] text-[11px] font-bold flex items-center gap-1 shadow-sm">
                <span>✨</span>
                <span>اقتراح ذكي</span>
              </span>
            )}
          </div>
          <span className="text-[14px] font-medium text-[#B4BECB] bg-[#16191F] px-3.5 py-1 rounded-full border border-[rgba(255,255,255,0.08)]">
            {categoryLabel}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-[22px] sm:text-[26px] font-bold text-[#F2F5F9] leading-snug">
          {renderBdi(currentItem.title)}
        </h2>

        {/* Photo if present */}
        {currentItem.photoUrl && (
          <div className="rounded-[20px] overflow-hidden max-h-[340px] bg-[#16191F] border border-[rgba(255,255,255,0.08)]">
            <img
              src={currentItem.photoUrl}
              alt={currentItem.title}
              className="w-full h-full object-cover max-h-[340px]"
            />
          </div>
        )}

        {/* Handover Stepper (1 to 4 steps) */}
        <div className="py-2">
          <HandoverStepper currentStep={handoverStep} />
        </div>

        {/* Metadata Strip: Location & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.08)] flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[#4D9BFF]" />
            </div>
            <div>
              <div className="text-[12px] text-[#B4BECB]">
                {STRINGS_AR.detail.campusLocationLabel}
              </div>
              <div className="text-[15px] font-bold text-[#F2F5F9]">
                {renderBdi(currentItem.location)}
                {currentItem.buildingNumber ? ` — ${renderBdi(currentItem.buildingNumber)}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.08)] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-[#4D9BFF]" />
            </div>
            <div>
              <div className="text-[12px] text-[#B4BECB]">
                {STRINGS_AR.detail.reportDateLabel}
              </div>
              <div className="text-[15px] font-bold text-[#F2F5F9] font-mono">
                {formatDate(currentItem.date)}
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h3 className="text-[15px] font-bold text-[#F2F5F9]">
            {STRINGS_AR.detail.descriptionLabel}
          </h3>
          <p className="text-[15px] text-[#B4BECB] leading-[1.7] whitespace-pre-line p-4 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)]">
            {renderBdi(currentItem.description)}
          </p>
        </div>

        {/* Verification Question Note (if Found item) */}
        {currentItem.type === 'found' && currentItem.verificationQuestion && (
          <div className="p-4 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-1.5">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#4D9BFF]">
              <Lock className="w-4 h-4 text-[#4D9BFF]" />
              <span>يتطلب استرداد هذا الغرض إجابة سؤال تحقق</span>
            </div>
            <p className="text-[13px] text-[#B4BECB] leading-relaxed">
              لحماية حقوق صاحب الغرض الأصلي، ستحتاج للإجابة عن سؤال تحقق يضعه واجد الغرض عند تقديم الطلب.
            </p>
          </div>
        )}

        {/* Ranked Auto-Matches Section */}
        {matches.length > 0 && !isResolved && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-[15px] font-bold text-[#F2F5F9]">
              <Sparkles className="w-4 h-4 text-[#4D9BFF]" />
              <span>{STRINGS_AR.detail.highMatchTitle}</span>
            </div>

            {matches.map(({ matchedItem, score, matchReasons, isPreliminary }) => (
              <div
                key={matchedItem.id}
                className="p-4 rounded-[20px] bg-[#16191F] border border-[#4D9BFF]/30 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-[#F2F5F9] line-clamp-1">
                    {renderBdi(matchedItem.title)}
                  </div>
                  {/* Match Card Meta Line: الموقع · التاريخ separated by a middle dot with spaces */}
                  <div className="text-[13px] text-[#B4BECB] flex items-center line-clamp-1">
                    <span>{renderBdi(matchedItem.location)}</span>
                    <span className="mx-1.5 text-[#B4BECB]/60">·</span>
                    <span>{formatDate(matchedItem.date)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {isMyItemReport(matchedItem, myDeviceId) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.12)] text-[11px] font-medium text-[#B4BECB]">
                        بلاغك
                      </span>
                    )}
                    {isPreliminary && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#101216] border border-[#FFB84D]/40 text-[11px] font-medium text-[#FFB84D]">
                        تطابق مبدئي
                      </span>
                    )}
                    {(() => {
                      const semantic = matchReasons.find(
                        (r) => r.includes('تشابه في الوصف') || r.includes('✨')
                      );
                      const others = matchReasons.filter((r) => r !== semantic);
                      const reasonsToShow = semantic
                        ? [semantic, ...others].slice(0, 3)
                        : matchReasons.slice(0, 2);
                      return reasonsToShow.map((reason, i) => (
                        <MatchReasonChip key={i} reason={reason} />
                      ));
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectItem(matchedItem)}
                    className="mt-2 min-h-[38px] px-4 py-1.5 rounded-full bg-[#2F6BFF] text-white text-[13px] font-semibold hover:bg-[#2F6BFF]/90 transition-all focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>{STRINGS_AR.detail.inspectMatchButton}</span>
                  </button>
                </div>
                <MatchScoreRing
                  score={score}
                  size={54}
                  strokeWidth={5}
                  showLabel={true}
                  label={isPreliminary ? 'تطابق مبدئي' : 'درجة التوافق'}
                />
              </div>
            ))}
          </div>
        )}

        {/* ============================================================== */}
        {/* PRIMARY ACTION STATE MACHINE (Evaluated strictly in order)       */}
        {/* ============================================================== */}
        <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-3">
          {/* ------------------------------------------------------------ */}
          {/* a) I AM THE OWNER (No claim button; show owner controls)       */}
          {/* ------------------------------------------------------------ */}
          {isOwner ? (
            <div className="p-4 sm:p-5 rounded-[20px] bg-[#16191F] border border-[#4D9BFF]/30 space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[15px] font-bold text-[#4D9BFF]">
                  <UserCheck className="w-5 h-5 text-[#4D9BFF]" />
                  <span>إدارة البلاغ</span>
                </div>
                <span className="text-[12px] font-semibold text-[#4D9BFF] bg-[#4D9BFF]/10 border border-[#4D9BFF]/30 px-3 py-1 rounded-full">
                  أنت ناشر هذا البلاغ
                </span>
              </div>

              {/* Pending claims to review */}
              {pendingClaims.length > 0 && !isResolved && (
                <div className="p-4 rounded-[16px] bg-[#FFB84D]/10 border border-[#FFB84D]/30 space-y-3">
                  <div className="text-[14px] font-bold text-[#FFB84D] flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>طلبات استرداد واردة بانتظار قرارك ({toArabicDigits(pendingClaims.length)})</span>
                  </div>
                  <div className="space-y-3">
                    {pendingClaims.map((claim) => (
                      <ClaimReviewCard
                        key={claim.id}
                        claim={claim}
                        itemId={currentItem.id}
                        itemDescription={currentItem.description}
                        verificationQuestion={currentItem.verificationQuestion}
                        isEvaluating={Boolean(evaluatingClaimsMap[claim.id])}
                        evaluatedConfidence={evaluatedClaimsData[claim.id]?.confidence}
                        evaluatedAssessment={evaluatedClaimsData[claim.id]?.assessment}
                        onApprove={(iId, cId) => onApproveClaim && onApproveClaim(iId, cId)}
                        onReject={(iId, cId, reason) => {
                          setConfirmingRejectClaimId(null);
                          if (onRejectClaim) onRejectClaim(iId, cId, reason);
                        }}
                        isRejectConfirming={confirmingRejectClaimId === claim.id}
                        onStartRejectConfirm={(cId) => setConfirmingRejectClaimId(cId)}
                        onCancelRejectConfirm={() => setConfirmingRejectClaimId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Approved claim awaiting handover */}
              {approvedClaim && !isResolved && (
                <div className="p-4 rounded-[16px] bg-[#3DDC97]/10 border border-[#3DDC97]/30 space-y-2">
                  <div className="text-[13px] font-bold text-[#3DDC97] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم قبول الطلب — بانتظار إتمام التسليم</span>
                  </div>
                  <div className="text-[13px] text-[#B4BECB] space-y-1">
                    <div>
                      المستلم: <strong className="text-[#F2F5F9]">{approvedClaim.claimantName}</strong> (
                      <span className="font-mono text-[#4D9BFF]">{approvedClaim.claimantPhone}</span>)
                    </div>
                    <button
                      type="button"
                      onClick={() => onMarkResolved(currentItem.id)}
                      className="mt-2 min-h-[38px] px-4 py-1.5 rounded-full bg-[#3DDC97] text-[#0A0B0D] font-bold text-[13px] hover:bg-[#3DDC97]/90 transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد إتمام التسليم وإغلاق البلاغ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Owner Action Buttons: Edit, Delete, Resolve */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => onEditItem(currentItem)}
                  className="flex-1 min-h-[46px] px-5 py-2.5 rounded-full bg-[#1F2633] text-[#4D9BFF] hover:bg-[#4D9BFF]/15 border border-[#4D9BFF]/40 font-bold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4D9BFF]"
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>تعديل البلاغ</span>
                </button>

                {/* Delete Button with in-place confirm (blocked if pending claim exists) */}
                {pendingClaims.length > 0 ? (
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setBlockedDeleteTooltip(!blockedDeleteTooltip)}
                      className="w-full min-h-[46px] px-5 py-2.5 rounded-full bg-[#16191F] text-[#B4BECB]/40 hover:text-[#FFB84D] border border-[rgba(255,255,255,0.08)] font-semibold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>حذف البلاغ</span>
                    </button>
                    {blockedDeleteTooltip && (
                      <div className="absolute left-0 bottom-full mb-2 w-full p-2.5 rounded-[12px] bg-[#1F1916] border border-[#FFB84D]/50 text-[#FFB84D] text-[12px] font-semibold shadow-xl z-20 text-center">
                        لا يمكن حذف بلاغ عليه طلب استرداد قائم — ارفض الطلب أولاً
                      </div>
                    )}
                  </div>
                ) : confirmingDelete ? (
                  <div
                    data-inline-confirm="true"
                    role="status"
                    aria-live="polite"
                    className="flex-1 min-h-[46px] px-3 py-1 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-center justify-between gap-2"
                  >
                    <span className="text-[12px] font-bold text-[#EF4444] ps-1 whitespace-nowrap">
                      تأكيد الحذف؟
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteItem(currentItem.id);
                          onNavigateToFeed();
                        }}
                        className="min-h-[32px] px-3.5 py-1 rounded-full bg-[#EF4444] text-white font-bold text-[12px] hover:bg-[#DC2626] transition-colors cursor-pointer"
                      >
                        نعم، احذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="min-h-[32px] px-2.5 py-1 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] text-[12px] transition-colors cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="flex-1 min-h-[46px] px-5 py-2.5 rounded-full bg-[#16191F] text-[#FF6B7A] hover:bg-[#FF6B7A]/10 border border-[#FF6B7A]/30 font-semibold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF6B7A]"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>حذف البلاغ</span>
                  </button>
                )}

                {/* Mark Resolved Button if not yet resolved */}
                {!isResolved && (
                  <button
                    type="button"
                    onClick={() => onMarkResolved(currentItem.id)}
                    className="min-h-[46px] px-5 py-2.5 rounded-full bg-[#2F6BFF] text-white font-bold text-[14px] hover:bg-[#2F6BFF]/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)]"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>تم التسليم</span>
                  </button>
                )}
              </div>
            </div>
          ) : /* ------------------------------------------------------------ */
          /* b) ITEM IS RESOLVED (Disabled, muted line - no action)        */
          /* ------------------------------------------------------------ */
          isResolved ? (
            <div className="w-full min-h-[50px] p-3.5 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[14px] font-medium text-[#B4BECB] flex items-center justify-center gap-2 select-none">
              <CheckCircle2 className="w-4 h-4 text-[#3DDC97]" />
              <span>تم استلام هذا الغرض</span>
            </div>
          ) : /* ------------------------------------------------------------ */
          /* c) I ALREADY HAVE A CLAIM ON THIS ITEM                         */
          /* ------------------------------------------------------------ */
          myClaim ? (
            myClaim.status === 'pending' ? (
              /* Case 1: Pending claim */
              <div className="p-4 sm:p-5 rounded-[20px] bg-[#16191F] border border-[#FFB84D]/30 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[15px] font-bold text-[#FFB84D]">
                    <Clock className="w-4 h-4 text-[#FFB84D]" />
                    <span>طلبك قيد مراجعة صاحب البلاغ</span>
                  </div>
                  <span className="text-[12px] font-mono text-[#B4BECB]">
                    تاريخ التقديم: {formatDate(myClaim.submittedAt)}
                  </span>
                </div>

                <p className="text-[13px] text-[#B4BECB] leading-relaxed">
                  تم إرسال إجابة التحقق الخاصة بك بنجاح إلى ناشر البلاغ. بمجرد قبوله الطلب، ستتمكن من رؤية معلومات التواصل ورمز الاستلام هنا وفي قسم طلباتي.
                </p>

                <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                  {onNavigateToMyClaims && (
                    <button
                      type="button"
                      onClick={onNavigateToMyClaims}
                      className="min-h-[38px] px-4 rounded-full bg-[#1F2633] text-[#4D9BFF] hover:bg-[#4D9BFF]/15 border border-[#4D9BFF]/30 font-semibold text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>عرض في طلباتي</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}

                  {/* Inline Cancel Confirm */}
                  {confirmingCancelClaim ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101216] border border-[#FF6B7A]/30 text-[12px]">
                      <span className="text-[#FF6B7A] font-semibold">إلغاء الطلب؟</span>
                      <button
                        type="button"
                        disabled={isCancellingClaim}
                        onClick={handleCancelClaimAction}
                        className="min-h-[28px] px-3 rounded-full bg-[#FF6B7A] text-white font-bold hover:bg-[#FF6B7A]/90 transition-colors cursor-pointer text-[12px]"
                      >
                        {isCancellingClaim ? 'جارٍ الإلغاء...' : 'نعم، ألغِ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancelClaim(false)}
                        className="min-h-[28px] px-2 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] transition-colors cursor-pointer text-[12px]"
                      >
                        تراجع
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingCancelClaim(true)}
                      className="min-h-[38px] px-3.5 rounded-full text-[13px] font-medium text-[#B4BECB] hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 border border-[rgba(255,255,255,0.08)] transition-colors cursor-pointer"
                    >
                      إلغاء الطلب
                    </button>
                  )}
                </div>
              </div>
            ) : myClaim.status === 'approved' ? (
              /* Case 2: Approved claim - Handover Panel */
              <div className="p-4 sm:p-5 rounded-[20px] bg-[#16191F] border border-[#3DDC97]/40 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[15px] font-bold text-[#3DDC97]">
                    <CheckCircle2 className="w-5 h-5 text-[#3DDC97]" />
                    <span>تمت الموافقة على طلب استردادك</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] font-mono text-[#3DDC97] bg-[#3DDC97]/10 px-3 py-1 rounded-full border border-[#3DDC97]/30">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>رمز الاستلام: TK-{currentItem.id.slice(0, 4).toUpperCase()}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-[14px] bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[13px] text-[#B4BECB] space-y-1">
                  <div>
                    بيانات التواصل مع المعلن: <strong className="text-[#F2F5F9]">{currentItem.contactName}</strong>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Phone className="w-4 h-4 text-[#4D9BFF]" />
                    <a href={`tel:${currentItem.contactPhone}`} className="font-mono text-[#4D9BFF] underline">
                      {currentItem.contactPhone}
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onMarkResolved(currentItem.id)}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-full bg-[#3DDC97] text-[#0A0B0D] font-bold text-[14px] hover:bg-[#3DDC97]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(61,220,151,0.3)]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الاستلام وإغلاق البلاغ</span>
                </button>
              </div>
            ) : (
              /* Case 3: Rejected claim */
              <div className="p-4 rounded-[18px] bg-[#FF6B7A]/10 border border-[#FF6B7A]/30 space-y-2">
                <div className="flex items-center gap-2 text-[14px] font-bold text-[#FF6B7A]">
                  <AlertCircle className="w-4 h-4 text-[#FF6B7A]" />
                  <span>تم رفض طلبك</span>
                </div>
                <p className="text-[13px] text-[#B4BECB]">
                  الإجابة المقدمة غير مطابقة لمواصفات الغرض أو البيانات غير كافية.
                </p>
              </div>
            )
          ) : /* ------------------------------------------------------------ */
          /* d) SOMEONE ELSE HAS A PENDING OR APPROVED CLAIM               */
          /* ------------------------------------------------------------ */
          hasOtherPendingOrApprovedClaim ? (
            <div className="w-full min-h-[50px] p-3.5 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[14px] text-[#B4BECB] flex items-center justify-center gap-2 select-none">
              <Clock className="w-4 h-4 text-[#FFB84D]" />
              <span>هناك طلب استرداد قيد المراجعة على هذا البلاغ</span>
            </div>
          ) : (
            /* ------------------------------------------------------------ */
            /* e) OTHERWISE -> SHOW CLEAN CLAIM BUTTON                       */
            /* ------------------------------------------------------------ */
            <button
              type="button"
              onClick={() => onOpenClaim(currentItem)}
              className="w-full min-h-[50px] px-6 py-3 rounded-full bg-[#2F6BFF] text-white text-[16px] font-bold hover:bg-[#2F6BFF] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] active:scale-[0.98] transition-all shadow-[0_0_16px_rgba(47,107,255,0.3)] flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer"
            >
              <span>
                {currentItem.type === 'found'
                  ? 'هذا غرضي — طلب استرداد'
                  : 'عثرت على هذا الغرض'}
              </span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
