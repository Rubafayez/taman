import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CampusItem, UserProfile, SentClaim, ClaimRequest } from '../types';
import { StatusBadge } from './StatusBadge';
import { ShieldIcon } from './ShieldIcon';
import { HandoverStepper } from './HandoverStepper';
import { ClaimReviewCard } from './ClaimReviewCard';
import { renderBdi } from '../utils/text';
import { formatDate } from '../utils/date';
import { toArabicDigits } from '../config/strings.ar';
import { validateName, validatePhone } from '../utils/validation';
import { profileService, DEFAULT_DISPLAY_NAME } from '../services/profileService';
import { itemsService } from '../services/itemsService';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit3,
  Plus,
  ArrowRight,
  Phone,
  Mail,
  User,
  Lock,
  Check,
  X,
  AlertCircle,
  Clock,
  KeyRound,
  ChevronLeft,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { STRINGS_AR } from '../config/strings.ar';

interface MyItemsScreenProps {
  myItems: CampusItem[];
  allItems: CampusItem[];
  onSelectItem: (item: CampusItem) => void;
  onEditItem: (item: CampusItem) => void;
  onMarkResolved: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onApproveClaim: (itemId: string, claimId: string) => void;
  onRejectClaim: (itemId: string, claimId: string, reason?: string) => void;
  onNavigateToPost: () => void;
  onNavigateToFeed: () => void;
}

type TypeFilter = 'all' | 'lost' | 'found';
type StatusFilter = 'all' | 'active' | 'under_review' | 'awaiting_handover' | 'resolved';

export const MyItemsScreen: React.FC<MyItemsScreenProps> = ({
  myItems,
  allItems,
  onSelectItem,
  onEditItem,
  onMarkResolved,
  onDeleteItem,
  onApproveClaim,
  onRejectClaim,
  onNavigateToPost,
  onNavigateToFeed,
}) => {
  // Parallel claim evaluation & rejection confirmation state
  const [evaluatingClaimsMap, setEvaluatingClaimsMap] = useState<Record<string, boolean>>({});
  const [evaluatedClaimsData, setEvaluatedClaimsData] = useState<
    Record<string, { confidence: number; assessment: string }>
  >({});
  const [confirmingRejectClaimId, setConfirmingRejectClaimId] = useState<string | null>(null);

  // 1. Profile State
  const [profile, setProfile] = useState<UserProfile>({
    deviceId: profileService.getDeviceId(),
    displayName: DEFAULT_DISPLAY_NAME,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  // Inline Display Name editing state
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Inline Contact block editing state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactNameInput, setContactNameInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [contactEmailInput, setContactEmailInput] = useState('');
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [isSavingContact, setIsSavingContact] = useState(false);

  // 2. Sent Claims State ("طلباتي")
  const [sentClaims, setSentClaims] = useState<SentClaim[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [confirmingCancelClaimId, setConfirmingCancelClaimId] = useState<string | null>(null);

  // 3. Filters State
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 4. Delete & Claim Rejection State
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [blockedDeleteTooltipId, setBlockedDeleteTooltipId] = useState<string | null>(null);
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const firstPendingCardRef = useRef<HTMLDivElement>(null);
  const deleteConfirmBtnRef = useRef<HTMLButtonElement>(null);

  // Load profile on mount and when allItems change (e.g. persona switch)
  useEffect(() => {
    profileService.getProfile().then((p) => {
      setProfile(p);
      setDisplayNameInput(p.displayName || DEFAULT_DISPLAY_NAME);
      setContactNameInput(p.contactName || '');
      setContactPhoneInput(p.contactPhone || '');
      setContactEmailInput(p.contactEmail || '');
    });
  }, [allItems]);

  // Load sent claims on mount and when allItems change
  useEffect(() => {
    setIsLoadingClaims(true);
    itemsService
      .getMyClaims()
      .then((claims) => setSentClaims(claims))
      .catch((err) => console.warn('Could not load sent claims:', err))
      .finally(() => setIsLoadingClaims(false));
  }, [allItems]);

  // Auto-cancel delete confirmation after 4 seconds
  useEffect(() => {
    if (!confirmingDeleteId) return;
    const timer = setTimeout(() => setConfirmingDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDeleteId]);

  // Click outside to close confirmation states
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (confirmingDeleteId && !target.closest('[data-delete-confirm-slot]')) {
        setConfirmingDeleteId(null);
      }
      if (blockedDeleteTooltipId && !target.closest('[data-blocked-delete-slot]')) {
        setBlockedDeleteTooltipId(null);
      }
      if (confirmingCancelClaimId && !target.closest('[data-cancel-claim-slot]')) {
        setConfirmingCancelClaimId(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [confirmingDeleteId, blockedDeleteTooltipId, confirmingCancelClaimId]);

  // Parallel evaluation for pending claims on my reports using Promise.allSettled
  useEffect(() => {
    const unassessedClaims: {
      claim: ClaimRequest;
      item: CampusItem;
    }[] = [];

    for (const item of myItems) {
      if (item.status === 'resolved' || !item.claims) continue;
      for (const claim of item.claims) {
        if (
          claim.status === 'pending' &&
          Boolean(claim.answerProvided) &&
          (claim.answerConfidence === undefined || claim.answerConfidence === null) &&
          !evaluatedClaimsData[claim.id] &&
          !itemsService.isClaimEvaluatedOrEvaluating(claim.id)
        ) {
          unassessedClaims.push({ claim, item });
          if (unassessedClaims.length >= 5) break;
        }
      }
      if (unassessedClaims.length >= 5) break;
    }

    if (unassessedClaims.length === 0) return;

    setEvaluatingClaimsMap((prev) => {
      const next = { ...prev };
      unassessedClaims.forEach(({ claim }) => {
        next[claim.id] = true;
        itemsService.markClaimAsEvaluating(claim.id);
      });
      return next;
    });

    Promise.allSettled(
      unassessedClaims.map(async ({ claim, item }) => {
        try {
          const result = await itemsService.evaluateClaimAnswer(
            claim.id,
            item.description,
            item.verificationQuestion || '',
            claim.answerProvided!
          );
          if (result) {
            setEvaluatedClaimsData((prev) => ({
              ...prev,
              [claim.id]: result,
            }));
            if (item.claims) {
              const target = item.claims.find((c) => c.id === claim.id);
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
  }, [myItems]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditingDisplayName(false);
        setIsEditingContact(false);
        setConfirmingDeleteId(null);
        setBlockedDeleteTooltipId(null);
        setConfirmingCancelClaimId(null);
        setRejectingClaimId(null);
        setConfirmingRejectClaimId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute Personal Summary counters
  const counters = useMemo(() => {
    const total = myItems.length;
    const resolved = myItems.filter((i) => i.status === 'resolved').length;
    const underReview = myItems.filter(
      (i) => i.status === 'active' && Boolean(i.claims && i.claims.length > 0)
    ).length;
    const pendingDecisions = myItems.reduce((acc, item) => {
      const pendingCount = item.claims?.filter((c) => c.status === 'pending').length || 0;
      return acc + pendingCount;
    }, 0);

    return {
      total,
      resolved,
      underReview,
      pendingDecisions,
    };
  }, [myItems]);

  // Filtered Items logic
  const filteredMyItems = useMemo(() => {
    return myItems.filter((item) => {
      // Type Filter
      if (typeFilter === 'lost' && item.type !== 'lost') return false;
      if (typeFilter === 'found' && item.type !== 'found') return false;

      // Status Filter
      if (statusFilter === 'active') {
        const hasPending = item.claims?.some((c) => c.status === 'pending');
        const hasApproved = item.claims?.some((c) => c.status === 'approved');
        if (item.status !== 'active' || hasPending || hasApproved) return false;
      } else if (statusFilter === 'under_review') {
        const hasPending = item.claims?.some((c) => c.status === 'pending');
        if (!hasPending) return false;
      } else if (statusFilter === 'awaiting_handover') {
        const hasApproved = item.claims?.some((c) => c.status === 'approved');
        if (!hasApproved || item.status === 'resolved') return false;
      } else if (statusFilter === 'resolved') {
        if (item.status !== 'resolved') return false;
      }

      return true;
    });
  }, [myItems, typeFilter, statusFilter]);

  // Handle Display Name Save
  const handleSaveDisplayName = async () => {
    const trimmed = displayNameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setDisplayNameError('يجب أن يكون الاسم بين حرفين و٣٠ حرفاً');
      return;
    }
    setDisplayNameError(null);
    const updated = await profileService.updateProfile({ displayName: trimmed });
    setProfile(updated);
    setIsEditingDisplayName(false);
  };

  // Handle Contact Info Save
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const nameErr = validateName(contactNameInput);
    if (nameErr) errors.name = nameErr;

    const phoneErr = validatePhone(contactPhoneInput);
    if (phoneErr) errors.phone = phoneErr;

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    setContactErrors({});
    setIsSavingContact(true);
    try {
      const updated = await profileService.updateProfile({
        contactName: contactNameInput.trim(),
        contactPhone: contactPhoneInput.trim(),
        contactEmail: contactEmailInput.trim() || undefined,
      });
      setProfile(updated);
      setIsEditingContact(false);
    } finally {
      setIsSavingContact(false);
    }
  };

  // Scroll to first pending item when clicking on "طلبات بانتظار قرارك" counter
  const handleScrollToPending = () => {
    if (counters.pendingDecisions > 0 && firstPendingCardRef.current) {
      firstPendingCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Cancel a sent claim
  const handleConfirmCancelClaim = async (claimId: string) => {
    await itemsService.cancelClaim(claimId);
    setSentClaims((prev) => prev.filter((c) => c.id !== claimId));
    setConfirmingCancelClaimId(null);
  };

  const firstLetter = (profile.displayName || 'ط').trim().charAt(0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 w-full min-w-0 pb-[88px]">
      {/* ============================================================== */}
      {/* 1. PROFILE HEADER                                               */}
      {/* ============================================================== */}
      <section className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-5 sm:p-7 space-y-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] text-right">
        {/* Avatar & Display Name Row */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
          {/* Avatar: circular badge with shield mark and first letter in --blue-600 */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#16191F] border-2 border-[#2F6BFF] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(47,107,255,0.25)]">
            <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
              <ShieldIcon size={46} className="text-[#2F6BFF]" />
            </div>
            <span className="relative z-10 text-[28px] sm:text-[32px] font-black text-[#2F6BFF] select-none">
              {firstLetter}
            </span>
          </div>

          {/* User Details & In-place Display Name Edit */}
          <div className="flex-1 min-w-0 space-y-2 text-center sm:text-right w-full">
            {isEditingDisplayName ? (
              <div className="space-y-1.5 w-full max-w-md">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDisplayName();
                      if (e.key === 'Escape') setIsEditingDisplayName(false);
                    }}
                    autoFocus
                    maxLength={30}
                    placeholder="اسم العرض (٢ - ٣٠ حرفاً)"
                    className="flex-1 min-h-[42px] px-3.5 rounded-full bg-[#16191F] border border-[#4D9BFF] text-[15px] font-bold text-[#F2F5F9] focus:outline-none focus:ring-1 focus:ring-[#4D9BFF]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDisplayName}
                    aria-label="حفظ الاسم"
                    className="w-10 h-10 min-w-[40px] rounded-full bg-[#2F6BFF] text-white flex items-center justify-center hover:bg-[#2F6BFF]/90 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayNameInput(profile.displayName || DEFAULT_DISPLAY_NAME);
                      setIsEditingDisplayName(false);
                      setDisplayNameError(null);
                    }}
                    aria-label="إلغاء تعديل الاسم"
                    className="w-10 h-10 min-w-[40px] rounded-full bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {displayNameError && (
                  <p className="text-[12px] text-[#FF6B7A] font-medium">{displayNameError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-[20px] sm:text-[22px] font-bold text-[#F2F5F9] tracking-tight">
                  {profile.displayName || DEFAULT_DISPLAY_NAME}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingDisplayName(true)}
                  aria-label="تعديل اسم العرض"
                  title="تعديل اسم العرض"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#B4BECB] hover:text-[#4D9BFF] hover:bg-[#4D9BFF]/10 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-[13px] text-[#B4BECB]">
              هوية الطالب المسجلة على هذا الجهاز · يتم حفظ البيانات وتعبئتها تلقائياً
            </p>
          </div>
        </div>

        {/* Saved Contact Block (Inline View or In-place Edit Form) */}
        <div className="p-4 sm:p-5 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] pb-2.5">
            <span className="text-[14px] font-bold text-[#F2F5F9] flex items-center gap-2">
              <User className="w-4 h-4 text-[#4D9BFF]" />
              <span>بيانات التواصل المعتمدة للتعبئة التلقائية</span>
            </span>

            {!isEditingContact && (
              <button
                type="button"
                onClick={() => {
                  setContactNameInput(profile.contactName || '');
                  setContactPhoneInput(profile.contactPhone || '');
                  setContactEmailInput(profile.contactEmail || '');
                  setContactErrors({});
                  setIsEditingContact(true);
                }}
                className="min-h-[34px] px-3 rounded-full text-[13px] font-semibold text-[#4D9BFF] hover:bg-[#4D9BFF]/10 border border-[#4D9BFF]/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
            )}
          </div>

          {isEditingContact ? (
            /* Inline Edit Form */
            <form onSubmit={handleSaveContact} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Contact Name */}
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#B4BECB]">
                    الاسم الكامل <span className="text-[#FF6B7A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactNameInput}
                    onChange={(e) => setContactNameInput(e.target.value)}
                    placeholder="مثال: فهد السبيعي"
                    className="w-full min-h-[42px] px-3.5 rounded-[12px] bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[14px] text-[#F2F5F9] focus:outline-none focus:border-[#4D9BFF]"
                  />
                  {contactErrors.name && (
                    <p className="text-[12px] text-[#FF6B7A]">{contactErrors.name}</p>
                  )}
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="block text-[12px] font-semibold text-[#B4BECB]">
                    رقم الجوال (05xxxxxxxx) <span className="text-[#FF6B7A]">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={contactPhoneInput}
                    onChange={(e) => setContactPhoneInput(e.target.value)}
                    placeholder="0500000000"
                    dir="ltr"
                    className="w-full min-h-[42px] px-3.5 rounded-[12px] bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[14px] font-mono text-[#F2F5F9] focus:outline-none focus:border-[#4D9BFF] text-left"
                  />
                  {contactErrors.phone && (
                    <p className="text-[12px] text-[#FF6B7A]">{contactErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Contact Email (Optional) */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-[#B4BECB]">
                  البريد الجامعي (اختياري)
                </label>
                <input
                  type="email"
                  value={contactEmailInput}
                  onChange={(e) => setContactEmailInput(e.target.value)}
                  placeholder="name@student.ksu.edu.sa"
                  dir="ltr"
                  className="w-full min-h-[42px] px-3.5 rounded-[12px] bg-[#101216] border border-[rgba(255,255,255,0.08)] text-[14px] text-[#F2F5F9] focus:outline-none focus:border-[#4D9BFF] text-left"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingContact(false)}
                  className="min-h-[38px] px-4 py-1.5 rounded-full text-[13px] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="min-h-[38px] px-5 py-1.5 rounded-full bg-[#2F6BFF] text-white text-[13px] font-bold hover:bg-[#2F6BFF]/90 transition-all cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)] disabled:opacity-60"
                >
                  {isSavingContact ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          ) : (
            /* View Mode */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px] text-[#B4BECB]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#4D9BFF] shrink-0" />
                <span className="truncate">
                  الاسم:{' '}
                  <strong className="text-[#F2F5F9]">
                    {profile.contactName || 'غير محدد بعد'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#4D9BFF] shrink-0" />
                <span className="truncate font-mono" dir="ltr">
                  <strong className="text-[#F2F5F9]">
                    {profile.contactPhone || 'غير محدد بعد'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#4D9BFF] shrink-0" />
                <span className="truncate" dir="ltr">
                  <strong className="text-[#F2F5F9]">
                    {profile.contactEmail || 'اختياري'}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Quiet Privacy Note */}
          <div className="flex items-center gap-2 text-[12px] text-[#B4BECB]/75 pt-1 border-t border-[rgba(255,255,255,0.04)]">
            <Lock className="w-3.5 h-3.5 text-[#4D9BFF] shrink-0" />
            <span>
              بياناتك مرتبطة بهذا الجهاز ولا تُشارك مع أحد. بيانات التواصل تظهر فقط بعد قبول طلب استرداد.
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. PERSONAL SUMMARY (4 small counters computed from this device) */}
      {/* ============================================================== */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full">
        {/* 1. بلاغاتي */}
        <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[18px] p-3.5 sm:p-4 text-center space-y-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <div className="text-[24px] sm:text-[28px] font-black text-[#4D9BFF] font-mono tabular-nums leading-none">
            {toArabicDigits(counters.total)}
          </div>
          <div className="text-[12px] sm:text-[13px] font-medium text-[#B4BECB]">بلاغاتي</div>
        </div>

        {/* 2. تم استرجاعها */}
        <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[18px] p-3.5 sm:p-4 text-center space-y-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <div className="text-[24px] sm:text-[28px] font-black text-[#4D9BFF] font-mono tabular-nums leading-none">
            {toArabicDigits(counters.resolved)}
          </div>
          <div className="text-[12px] sm:text-[13px] font-medium text-[#B4BECB]">تم استرجاعها</div>
        </div>

        {/* 3. قيد المراجعة */}
        <div className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[18px] p-3.5 sm:p-4 text-center space-y-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <div className="text-[24px] sm:text-[28px] font-black text-[#4D9BFF] font-mono tabular-nums leading-none">
            {toArabicDigits(counters.underReview)}
          </div>
          <div className="text-[12px] sm:text-[13px] font-medium text-[#B4BECB]">قيد المراجعة</div>
        </div>

        {/* 4. طلبات بانتظار قرارك (Highlighted when > 0, scrolls to pending) */}
        <div
          onClick={handleScrollToPending}
          className={`rounded-[18px] p-3.5 sm:p-4 text-center space-y-1 transition-all ${
            counters.pendingDecisions > 0
              ? 'bg-[#FFB84D]/10 border-2 border-[#FFB84D] shadow-[0_0_14px_rgba(255,184,77,0.2)] cursor-pointer hover:scale-[1.02]'
              : 'bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
          }`}
        >
          <div
            className={`text-[24px] sm:text-[28px] font-black font-mono tabular-nums leading-none ${
              counters.pendingDecisions > 0 ? 'text-[#FFB84D]' : 'text-[#4D9BFF]'
            }`}
          >
            {toArabicDigits(counters.pendingDecisions)}
          </div>
          <div
            className={`text-[12px] sm:text-[13px] font-medium ${
              counters.pendingDecisions > 0 ? 'text-[#FFB84D] font-bold' : 'text-[#B4BECB]'
            }`}
          >
            طلبات بانتظار قرارك
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. FILTERS FOR MY ITEMS                                         */}
      {/* ============================================================== */}
      <section className="space-y-3 min-w-0 w-full text-right">
        {/* Row 1: النوع: الكل · ضاع مني · لقيته */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#F2F5F9] shrink-0 ps-1">النوع:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('lost')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                typeFilter === 'lost'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              ضاع مني
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('found')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                typeFilter === 'found'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              لقيته
            </button>
          </div>
        </div>

        {/* Row 2: الحالة: الكل · نشط · قيد المراجعة · بانتظار التسليم · تم التسليم */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#F2F5F9] shrink-0 ps-1">الحالة:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              نشط
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('under_review')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'under_review'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              قيد المراجعة
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('awaiting_handover')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'awaiting_handover'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              بانتظار التسليم
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'resolved'
                  ? 'bg-[#2F6BFF] text-white shadow-[0_0_10px_rgba(47,107,255,0.35)]'
                  : 'bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)]'
              }`}
            >
              تم التسليم
            </button>
          </div>
        </div>

        {/* Result line: "٤ بلاغات" (count only, no repeated wording) + New Post button */}
        <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.06)] px-1">
          <div className="text-[14px] font-bold text-[#F2F5F9]">
            {toArabicDigits(filteredMyItems.length)} {filteredMyItems.length === 1 ? 'بلاغ' : 'بلاغات'}
          </div>

          <button
            type="button"
            onClick={onNavigateToPost}
            className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#2F6BFF] text-white text-[13px] font-bold hover:bg-[#2F6BFF]/90 transition-all inline-flex items-center gap-1.5 shadow-[0_0_12px_rgba(47,107,255,0.3)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة بلاغ</span>
          </button>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. MY ITEMS LIST                                                */}
      {/* ============================================================== */}
      <section className="space-y-4">
        {filteredMyItems.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {filteredMyItems.map((item, index) => {
              const isResolved = item.status === 'resolved';
              const pendingClaims = item.claims?.filter((c) => c.status === 'pending') || [];
              const approvedClaims = item.claims?.filter((c) => c.status === 'approved') || [];
              const hasPendingClaims = pendingClaims.length > 0;

              const isConfirmingDelete = confirmingDeleteId === item.id;
              const isBlockedTooltip = blockedDeleteTooltipId === item.id;

              return (
                <motion.article
                  key={item.id}
                  ref={hasPendingClaims && !index ? firstPendingCardRef : undefined}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={`bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 space-y-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] text-right transition-all min-w-0 ${
                    isResolved ? 'opacity-65' : ''
                  }`}
                >
                  {/* Top Row: Status Badge + Actions (Edit & Delete) */}
                  <div className="flex items-center justify-between min-w-0 w-full gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        type={item.type}
                        status={item.status}
                        animateResolved={isResolved}
                      />
                      {item.aiGenerated && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#16191F] border border-[#4D9BFF]/30 text-[#4D9BFF] text-[11px] font-bold flex items-center gap-1 shadow-sm">
                          <span>✨</span>
                          <span className="hidden sm:inline">اقتراح ذكي</span>
                        </span>
                      )}
                    </div>

                    {/* Actions: Inline Edit & Delete with blocked check */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Inline Edit Button */}
                      <button
                        type="button"
                        onClick={() => onEditItem(item)}
                        aria-label="تعديل بيانات البلاغ"
                        title="تعديل بيانات البلاغ"
                        className="h-10 min-h-[40px] px-3 rounded-full flex items-center gap-1.5 text-[13px] font-semibold text-[#B4BECB] hover:text-[#4D9BFF] hover:bg-[#4D9BFF]/10 border border-[rgba(255,255,255,0.08)] hover:border-[#4D9BFF]/30 transition-colors focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">تعديل</span>
                      </button>

                      {/* Delete Slot: Blocked if has pending claim */}
                      <div
                        data-delete-confirm-slot={item.id}
                        data-blocked-delete-slot={item.id}
                        className="relative flex items-center justify-end h-10 min-h-[40px] shrink-0"
                      >
                        {hasPendingClaims ? (
                          /* Blocked Delete state */
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setBlockedDeleteTooltipId(isBlockedTooltip ? null : item.id)}
                              aria-label="لا يمكن حذف بلاغ عليه طلب استرداد قائم"
                              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#B4BECB]/40 hover:text-[#FFB84D] hover:bg-[#FFB84D]/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" />
                            </button>
                            {isBlockedTooltip && (
                              <div
                                role="tooltip"
                                className="absolute left-0 bottom-full mb-2 w-64 p-2.5 rounded-[12px] bg-[#1F1916] border border-[#FFB84D]/50 text-[#FFB84D] text-[12px] font-semibold shadow-xl z-20"
                              >
                                لا يمكن حذف بلاغ عليه طلب استرداد قائم — ارفض الطلب أولاً
                              </div>
                            )}
                          </div>
                        ) : isConfirmingDelete ? (
                          /* Inline Confirm Delete */
                          <div
                            data-inline-confirm="true"
                            role="status"
                            aria-live="polite"
                            className="inline-flex items-center gap-1.5 h-10 px-2 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.12)] text-[12px] shadow-sm animate-in fade-in"
                          >
                            <span className="text-[#B4BECB] font-medium ps-1 whitespace-nowrap">
                              متأكد؟
                            </span>
                            <button
                              ref={deleteConfirmBtnRef}
                              type="button"
                              onClick={() => {
                                onDeleteItem(item.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="min-h-[28px] px-3 py-0.5 rounded-full bg-[#FF6B7A] text-white font-bold hover:bg-[#FF6B7A]/90 transition-colors cursor-pointer text-[12px] whitespace-nowrap"
                            >
                              حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="min-h-[28px] px-2 py-0.5 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] transition-colors cursor-pointer text-[12px] font-medium whitespace-nowrap"
                            >
                              لا
                            </button>
                          </div>
                        ) : (
                          /* Quiet Trash Button */
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(item.id)}
                            aria-label={STRINGS_AR.myItems.deleteAria}
                            title={STRINGS_AR.myItems.deleteButton}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#B4BECB] hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#FF6B7A] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h2
                    onClick={() => onSelectItem(item)}
                    className="text-[17px] sm:text-[18px] font-bold text-[#F2F5F9] hover:text-[#4D9BFF] transition-colors cursor-pointer line-clamp-2 leading-[1.4]"
                  >
                    {renderBdi(item.title)}
                  </h2>

                  {/* Location & Date */}
                  <div className="flex items-center gap-3 text-[12px] sm:text-[13px] text-[#B4BECB] flex-wrap">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#4D9BFF] shrink-0" />
                      {renderBdi(item.location)}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#4D9BFF] shrink-0" />
                      {formatDate(item.date)}
                    </span>
                  </div>

                  {/* Pending Claims Section on this Item */}
                  {pendingClaims.length > 0 && !isResolved && (
                    <div className="p-3.5 rounded-[16px] bg-[#FFB84D]/10 border border-[#FFB84D]/30 space-y-2.5">
                      <div className="text-[13px] font-bold text-[#FFB84D] flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>طلبات استرداد واردة بانتظار قرارك ({toArabicDigits(pendingClaims.length)})</span>
                      </div>
                      <div className="space-y-3">
                        {pendingClaims.map((claim) => (
                          <ClaimReviewCard
                            key={claim.id}
                            claim={claim}
                            itemId={item.id}
                            itemDescription={item.description}
                            verificationQuestion={item.verificationQuestion}
                            isEvaluating={Boolean(evaluatingClaimsMap[claim.id])}
                            evaluatedConfidence={evaluatedClaimsData[claim.id]?.confidence}
                            evaluatedAssessment={evaluatedClaimsData[claim.id]?.assessment}
                            onApprove={(iId, cId) => onApproveClaim(iId, cId)}
                            onReject={(iId, cId, reason) => {
                              setConfirmingRejectClaimId(null);
                              onRejectClaim(iId, cId, reason);
                            }}
                            isRejectConfirming={confirmingRejectClaimId === claim.id}
                            onStartRejectConfirm={(cId) => setConfirmingRejectClaimId(cId)}
                            onCancelRejectConfirm={() => setConfirmingRejectClaimId(null)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approved Handover Card */}
                  {approvedClaims.length > 0 && !isResolved && (
                    <div className="p-3.5 rounded-[16px] bg-[#3DDC97]/10 border border-[#3DDC97]/30 space-y-2">
                      <div className="text-[13px] font-bold text-[#3DDC97] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم قبول الطلب — بانتظار إتمام التسليم</span>
                      </div>
                      {approvedClaims.map((claim) => (
                        <div key={claim.id} className="text-[13px] text-[#B4BECB] space-y-1">
                          <div>
                            المستلم:{' '}
                            <strong className="text-[#F2F5F9]">{claim.claimantName}</strong> (
                            <span className="font-mono text-[#4D9BFF]">{claim.claimantPhone}</span>
                            )
                          </div>
                          <button
                            type="button"
                            onClick={() => onMarkResolved(item.id)}
                            className="mt-2 min-h-[36px] px-4 py-1.5 rounded-full bg-[#3DDC97] text-[#0A0B0D] font-bold text-[13px] hover:bg-[#3DDC97]/90 transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تأكيد إتمام التسليم</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        ) : (
          /* Empty State per Filter */
          <div className="py-14 px-6 text-center rounded-[24px] bg-[#101216] border border-[rgba(255,255,255,0.08)] max-w-md mx-auto my-4 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF]">
              <ShieldIcon size={32} className="text-[#4D9BFF]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[17px] font-bold text-[#F2F5F9]">لا توجد بلاغات تطابق الفلتر</h3>
              <p className="text-[14px] text-[#B4BECB]">
                يمكنك نشر بلاغ جديد عن مفقود أو معثور عليه في الحرم الجامعي
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToPost}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#2F6BFF] text-white text-[14px] font-bold hover:bg-[#2F6BFF]/90 transition-all cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)] inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة بلاغ</span>
            </button>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 5. MY CLAIMS ("طلباتي" - requests I sent on other items)       */}
      {/* ============================================================== */}
      <section className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-5 sm:p-7 space-y-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] text-right">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] pb-3">
          <div>
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F2F5F9]">
              طلباتي ({toArabicDigits(sentClaims.length)})
            </h2>
            <p className="text-[13px] text-[#B4BECB]">
              طلبات الاسترداد التي أرسلتها على أغراض أعلن عنها طلاب آخرون
            </p>
          </div>
        </div>

        {sentClaims.length > 0 ? (
          <div className="space-y-3">
            {sentClaims.map((claim) => {
              const isConfirmingCancel = confirmingCancelClaimId === claim.id;

              return (
                <div
                  key={claim.id}
                  className="p-4 rounded-[18px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-[12px] font-bold border ${
                        claim.status === 'approved'
                          ? 'bg-[#3DDC97]/15 text-[#3DDC97] border-[#3DDC97]/30'
                          : claim.status === 'rejected'
                          ? 'bg-[#FF6B7A]/15 text-[#FF6B7A] border-[#FF6B7A]/30'
                          : 'bg-[#FFB84D]/15 text-[#FFB84D] border-[#FFB84D]/30'
                      }`}
                    >
                      {claim.status === 'approved'
                        ? 'مقبول'
                        : claim.status === 'rejected'
                        ? 'مرفوض'
                        : 'بانتظار المراجعة'}
                    </span>

                    <span className="text-[12px] font-mono text-[#B4BECB]">
                      {formatDate(claim.submittedAt)}
                    </span>
                  </div>

                  {/* Item Title & Tap Target to open Detail */}
                  <div
                    onClick={() => {
                      const matchedItem = allItems.find((i) => i.id === claim.itemId);
                      if (matchedItem) onSelectItem(matchedItem);
                    }}
                    className="cursor-pointer group"
                  >
                    <h3 className="text-[16px] font-bold text-[#F2F5F9] group-hover:text-[#4D9BFF] transition-colors line-clamp-1">
                      {claim.itemTitle}
                    </h3>
                    <p className="text-[13px] text-[#B4BECB] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#4D9BFF]" />
                      <span>{claim.itemLocation}</span>
                      <ChevronLeft className="w-4 h-4 mr-auto group-hover:-translate-x-1 transition-transform text-[#4D9BFF]" />
                    </p>
                  </div>

                  {/* Approved Details: Handover Code & Contact */}
                  {claim.status === 'approved' && (
                    <div className="p-3.5 rounded-[14px] bg-[#3DDC97]/10 border border-[#3DDC97]/30 space-y-2 text-[13px]">
                      {claim.handoverCode && (
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-[#3DDC97]" />
                          <span className="text-[#B4BECB]">رمز الاستلام:</span>
                          <strong className="font-mono text-[#3DDC97] tracking-wider text-[14px]">
                            {claim.handoverCode}
                          </strong>
                        </div>
                      )}
                      {claim.otherPartyContact && (
                        <div className="text-[#B4BECB]">
                          للتنسيق مع المعلن:{' '}
                          <strong className="text-[#F2F5F9]">
                            {claim.otherPartyContact.name}
                          </strong>{' '}
                          (
                          <a
                            href={`tel:${claim.otherPartyContact.phone}`}
                            className="font-mono text-[#4D9BFF] underline"
                          >
                            {claim.otherPartyContact.phone}
                          </a>
                          )
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejected Details: Reason */}
                  {claim.status === 'rejected' && (
                    <div className="p-3 rounded-[12px] bg-[#FF6B7A]/10 border border-[#FF6B7A]/25 text-[13px] text-[#FF6B7A] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {claim.rejectionReason?.startsWith('سبب الرفض')
                          ? claim.rejectionReason
                          : `سبب الرفض: ${claim.rejectionReason || 'الإجابة غير صحيحة'}`}
                      </span>
                    </div>
                  )}

                  {/* Pending Action: Cancel Claim with inline confirm */}
                  {claim.status === 'pending' && (
                    <div
                      data-cancel-claim-slot={claim.id}
                      className="pt-1 flex items-center justify-end"
                    >
                      {isConfirmingCancel ? (
                        <div
                          data-inline-confirm="true"
                          role="status"
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.12)] text-[12px]"
                        >
                          <span className="text-[#FF6B7A] font-semibold">إلغاء الطلب؟</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmCancelClaim(claim.id)}
                            className="min-h-[28px] px-3 py-0.5 rounded-full bg-[#FF6B7A] text-white font-bold hover:bg-[#FF6B7A]/90 transition-colors cursor-pointer"
                          >
                            نعم، ألغِ
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingCancelClaimId(null)}
                            className="min-h-[28px] px-2 py-0.5 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] transition-colors cursor-pointer"
                          >
                            تراجع
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingCancelClaimId(claim.id)}
                          className="min-h-[32px] px-3 py-1 rounded-full text-[12px] font-semibold text-[#B4BECB] hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 border border-[rgba(255,255,255,0.08)] transition-colors cursor-pointer"
                        >
                          إلغاء الطلب
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-[#B4BECB] text-[14px]">
            لم تقم بتقديم طلب استرداد على أي بلاغ حتى الآن.
          </div>
        )}
      </section>
    </div>
  );
};
