import React, { useState, useEffect } from 'react';
import { CampusItem, ClaimRequest } from '../types';
import { ShieldIcon } from './ShieldIcon';
import { HandoverStepper } from './HandoverStepper';
import { X, Lock, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { STRINGS_AR } from '../config/strings.ar';
import { VALIDATION_LIMITS } from '../config/constants';
import { renderBdi } from '../utils/text';
import {
  validateClaimForm,
  validateName,
  validatePhone,
  validateClaimAnswer,
  normalizePhoneNumber,
} from '../utils/validation';
import { profileService } from '../services/profileService';

interface ClaimModalProps {
  item: CampusItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitClaim: (
    itemId: string,
    claim: Omit<ClaimRequest, 'id' | 'submittedAt' | 'status'>
  ) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  item,
  isOpen,
  onClose,
  onSubmitClaim,
}) => {
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setContactPhone] = useState('');
  const [claimantAnswer, setClaimantAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
      const local = profileService.getLocalProfile();
      setClaimantName(local.contactName || '');
      setContactPhone(local.contactPhone || '');
      profileService
        .getProfile()
        .then((p) => {
          if (p.contactName) setClaimantName(p.contactName);
          if (p.contactPhone) setContactPhone(p.contactPhone);
        })
        .catch(() => {});
      setClaimantAnswer('');
      setErrors({});
      setTouched({});
      setSummaryError(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const hasVerificationQuestion = Boolean(item.verificationQuestion?.trim());

  const focusAndScrollToField = (fieldKey: string) => {
    const el = document.getElementById(`claim-${fieldKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') {
        el.focus();
      }
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let error: string | null = null;

    switch (field) {
      case 'claimantAnswer':
        error = validateClaimAnswer(claimantAnswer, hasVerificationQuestion);
        break;
      case 'claimantName':
        error = validateName(claimantName);
        break;
      case 'claimantPhone':
        error = validatePhone(claimantPhone);
        break;
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleNameChange = (val: string) => {
    setClaimantName(val);
    if (touched.claimantName) {
      const err = validateName(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.claimantName = err;
        else delete next.claimantName;
        return next;
      });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizePhoneNumber(e.target.value);
    setContactPhone(normalized);

    if (touched.claimantPhone) {
      const err = validatePhone(normalized);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.claimantPhone = err;
        else delete next.claimantPhone;
        return next;
      });
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Tab' ||
      e.key === 'Enter' ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    if (!/^[0-9٠-٩]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleAnswerChange = (val: string) => {
    setClaimantAnswer(val);
    if (touched.claimantAnswer) {
      const err = validateClaimAnswer(val, hasVerificationQuestion);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.claimantAnswer = err;
        else delete next.claimantAnswer;
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateClaimForm(
      claimantName,
      claimantPhone,
      claimantAnswer,
      hasVerificationQuestion
    );

    if (!validation.isValid) {
      const allTouched: Record<string, boolean> = {
        claimantName: true,
        claimantPhone: true,
      };
      if (hasVerificationQuestion) {
        allTouched.claimantAnswer = true;
      }
      setTouched(allTouched);
      setErrors(validation.errors);

      setSummaryError(STRINGS_AR.validation.summaryError(validation.errorCount));

      if (validation.firstErrorField) {
        focusAndScrollToField(validation.firstErrorField);
      }
      return;
    }

    setSummaryError(null);
    setErrors({});

    onSubmitClaim(item.id, {
      claimantName: claimantName.trim(),
      claimantPhone: claimantPhone.trim(),
      answerProvided: claimantAnswer.trim() || undefined,
    });

    setIsSubmitted(true);
  };

  const handleClose = () => {
    setIsSubmitted(false);
    onClose();
  };

  const isFieldInvalid = (fieldName: string) =>
    touched[fieldName] && Boolean(errors[fieldName]);
  const isFieldValidAfterBlur = (fieldName: string) =>
    touched[fieldName] && !errors[fieldName];
  const isPhoneLiveValid =
    claimantPhone.length === VALIDATION_LIMITS.phone.exactLength &&
    claimantPhone.startsWith(VALIDATION_LIMITS.phone.prefix);

  return (
    <AnimatePresence>
      {/* Modal Backdrop: rgba(0,0,0,.65) + 6px blur */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[6px] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-modal-title"
      >
        {/* Modal Panel: --bg-900 (#101216) + --line border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#101216] text-[#F2F5F9] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.08)] overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF]">
                <ShieldIcon size={22} className="text-[#4D9BFF]" />
              </div>
              <div>
                <h2
                  id="claim-modal-title"
                  className="text-[18px] sm:text-[20px] font-bold text-[#F2F5F9]"
                >
                  {STRINGS_AR.claim.modalTitle}
                </h2>
                <p className="text-[13px] text-[#B4BECB]">
                  {STRINGS_AR.claim.modalSubtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label={STRINGS_AR.claim.closeAria}
              className="p-2 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] hover:bg-[#16191F] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper indicator inside Modal */}
          <div className="bg-[#16191F]/50 border-b border-[rgba(255,255,255,0.08)] px-4 py-1">
            <HandoverStepper currentStep={isSubmitted ? 2 : 1} isResolved={false} />
          </div>

          {!isSubmitted ? (
            <form noValidate onSubmit={handleSubmit} className="p-6 space-y-5">
              {summaryError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-full bg-[#FF6B7A]/10 border border-[#FF6B7A] text-[#FF6B7A] flex items-center gap-2 text-[14px] font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{summaryError}</span>
                </div>
              )}

              {/* Target Item summary */}
              <div className="p-4 rounded-[18px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                <div className="text-[13px] font-medium text-[#B4BECB]">
                  {item.location}
                </div>
                <div className="text-[16px] font-bold text-[#F2F5F9] mt-0.5">
                  {renderBdi(item.title)}
                </div>
              </div>

              {/* Verification question block */}
              {hasVerificationQuestion && (
                <div className="p-4 rounded-[18px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-2">
                  <div className="text-[14px] font-bold text-[#F2F5F9]">
                    {STRINGS_AR.fields.verificationQuestion.promptForClaimant}
                  </div>
                  <p className="text-[15px] font-medium text-[#F2F5F9] bg-[#0A0B0D] p-3 rounded-xl border border-[rgba(255,255,255,0.08)]">
                    "{renderBdi(item.verificationQuestion)}"
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="claim-claimantAnswer"
                        className="text-[14px] font-semibold text-[#F2F5F9] flex items-center gap-1.5"
                      >
                        <span>{STRINGS_AR.fields.claimAnswer.label}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                          {STRINGS_AR.chips.required}
                        </span>
                      </label>
                    </div>

                    <div className="relative">
                      <textarea
                        id="claim-claimantAnswer"
                        rows={2}
                        value={claimantAnswer}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        onBlur={() => handleBlur('claimantAnswer')}
                        placeholder={STRINGS_AR.fields.claimAnswer.placeholder}
                        aria-invalid={isFieldInvalid('claimantAnswer') ? 'true' : 'false'}
                        aria-describedby={isFieldInvalid('claimantAnswer') ? 'error-claim-answer' : undefined}
                        className={`w-full px-4 py-3 text-[16px] min-h-[48px] rounded-2xl bg-[#0A0B0D] text-[#F2F5F9] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none leading-[1.6] ${
                          isFieldInvalid('claimantAnswer')
                            ? 'border-2 border-[#FF6B7A]'
                            : isFieldValidAfterBlur('claimantAnswer')
                            ? 'border-2 border-[#4D9BFF]'
                            : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                        }`}
                      />

                      {isFieldInvalid('claimantAnswer') && (
                        <div className="absolute left-3 top-3 text-[#FF6B7A] pointer-events-none">
                          <AlertCircle className="w-5 h-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <p className="text-[12px] text-[#B4BECB]">
                      {STRINGS_AR.fields.claimAnswer.helper}
                    </p>

                    {isFieldInvalid('claimantAnswer') && (
                      <p
                        id="error-claim-answer"
                        role="alert"
                        className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{errors.claimantAnswer}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Claimant Contact Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[#F2F5F9]">
                    {STRINGS_AR.fields.contactBlock.title}
                  </span>
                  <span className="text-[13px] text-[#B4BECB] flex items-center gap-1 font-medium">
                    <Lock className="w-3.5 h-3.5 text-[#4D9BFF]" aria-hidden="true" />
                    <span>{STRINGS_AR.fields.contactBlock.privacyBadge}</span>
                  </span>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="claim-claimantName"
                      className="text-[14px] font-semibold text-[#F2F5F9] flex items-center gap-1.5"
                    >
                      <span>{STRINGS_AR.fields.name.label}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                        {STRINGS_AR.chips.required}
                      </span>
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      id="claim-claimantName"
                      type="text"
                      placeholder={STRINGS_AR.fields.name.placeholder}
                      value={claimantName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={() => handleBlur('claimantName')}
                      aria-invalid={isFieldInvalid('claimantName') ? 'true' : 'false'}
                      aria-describedby={isFieldInvalid('claimantName') ? 'error-claim-name' : undefined}
                      className={`w-full px-4 py-3 min-h-[48px] text-[16px] rounded-full bg-[#16191F] text-[#F2F5F9] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none ${
                        isFieldInvalid('claimantName')
                          ? 'border-2 border-[#FF6B7A]'
                          : isFieldValidAfterBlur('claimantName')
                          ? 'border-2 border-[#4D9BFF]'
                          : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                      }`}
                    />

                    {isFieldInvalid('claimantName') && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF6B7A] pointer-events-none">
                        <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                    {isFieldValidAfterBlur('claimantName') && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4D9BFF] pointer-events-none">
                        <Check className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] text-[#B4BECB]">
                    {STRINGS_AR.fields.name.helper}
                  </p>

                  {isFieldInvalid('claimantName') && (
                    <p
                      id="error-claim-name"
                      role="alert"
                      className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{errors.claimantName}</span>
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="claim-claimantPhone"
                      className="text-[14px] font-semibold text-[#F2F5F9] flex items-center gap-1.5"
                    >
                      <span>{STRINGS_AR.fields.phone.label}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                        {STRINGS_AR.chips.required}
                      </span>
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      id="claim-claimantPhone"
                      type="tel"
                      inputMode="numeric"
                      placeholder={STRINGS_AR.fields.phone.placeholder}
                      value={claimantPhone}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      onBlur={() => handleBlur('claimantPhone')}
                      aria-invalid={isFieldInvalid('claimantPhone') ? 'true' : 'false'}
                      aria-describedby={isFieldInvalid('claimantPhone') ? 'error-claim-phone' : undefined}
                      className={`w-full px-4 py-3 min-h-[48px] text-[16px] font-mono rounded-full bg-[#16191F] text-[#F2F5F9] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none ${
                        isFieldInvalid('claimantPhone')
                          ? 'border-2 border-[#FF6B7A]'
                          : isFieldValidAfterBlur('claimantPhone') || isPhoneLiveValid
                          ? 'border-2 border-[#4D9BFF]'
                          : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                      }`}
                    />

                    {isFieldInvalid('claimantPhone') && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF6B7A] pointer-events-none">
                        <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                    {(isFieldValidAfterBlur('claimantPhone') || isPhoneLiveValid) && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4D9BFF] pointer-events-none">
                        <Check className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] text-[#B4BECB]">
                    {STRINGS_AR.fields.phone.helper}
                  </p>

                  {isFieldInvalid('claimantPhone') && (
                    <p
                      id="error-claim-phone"
                      role="alert"
                      className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{errors.claimantPhone}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Actions: Pill buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] py-3 px-5 rounded-full bg-[#2F6BFF] text-white font-bold text-[15px] hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] active:scale-[0.98] transition-all shadow-[0_0_12px_rgba(47,107,255,0.3)] flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4D9BFF]"
                >
                  {STRINGS_AR.claim.submitButton}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[48px] py-3 px-5 rounded-full border border-[rgba(255,255,255,0.08)] hover:border-[#4D9BFF] text-[#B4BECB] hover:text-[#F2F5F9] text-[14px] font-medium transition-colors cursor-pointer"
                >
                  {STRINGS_AR.claim.cancelButton}
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation: In pending state */
            <div className="p-8 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF]">
                <ShieldIcon size={34} className="text-[#4D9BFF]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-[20px] font-bold text-[#F2F5F9]">
                  {STRINGS_AR.claim.successTitle}
                </h3>
                <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#FFB84D]/12 text-[#FFB84D] text-[14px] font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-[#FFB84D]" />
                  <span>{STRINGS_AR.claim.pendingBadge}</span>
                </div>
                <p className="text-[15px] text-[#B4BECB] leading-[1.6] max-w-sm mx-auto pt-1">
                  {STRINGS_AR.claim.successDesc}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full min-h-[48px] py-3 px-5 rounded-full bg-[#2F6BFF] text-white font-bold text-[15px] hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] transition-all cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)]"
              >
                {STRINGS_AR.claim.dismissSuccess}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
