import React, { useState, useRef } from 'react';
import { CampusItem, ItemCategory, ItemType, AutoMatchResult } from '../types';
import { CAMPUS_LOCATIONS, CATEGORIES, VALIDATION_LIMITS } from '../config/constants';
import { STRINGS_AR, toArabicDigits } from '../config/strings.ar';
import { renderBdi } from '../utils/text';
import { formatDate } from '../utils/date';
import {
  validateItemForm,
  validateType,
  validateCategory,
  validateDescription,
  validateLocation,
  validateDate,
  validateName,
  validatePhone,
  validateVerificationQuestion,
  validatePhotoFile,
  normalizePhoneNumber,
} from '../utils/validation';
import { findAutoMatches, isMyItemReport } from '../utils/matching';
import { StatusBadge } from './StatusBadge';
import {
  Lock,
  ArrowRight,
  Camera,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Sparkles,
  AlertCircle,
  Check,
  Shield,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MatchScoreRing } from './MatchScoreRing';
import { MatchReasonChip } from './MatchReasonChip';
import { AiSparkleChip } from './AiSparkleChip';
import { PrivacyGuardianPanel } from './PrivacyGuardianPanel';
import { profileService } from '../services/profileService';
import { aiService, PrivacyReviewResult, ImagePrivacyResult } from '../services/aiService';
import { maskSensitivePhoto, dataUrlToFile } from '../utils/imageMasking';

interface PostScreenProps {
  existingItems: CampusItem[];
  onItemCreated: (newItem: Omit<CampusItem, 'id' | 'createdAt' | 'status'>) => Promise<CampusItem>;
  onNavigateToDetail: (item: CampusItem) => void;
  onNavigateToFeed: () => void;
  editMode?: boolean;
  editingItem?: CampusItem | null;
  onItemUpdated?: (updated: CampusItem) => Promise<void>;
  onCancelEdit?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
}

export const PostScreen: React.FC<PostScreenProps> = ({
  existingItems,
  onItemCreated,
  onNavigateToDetail,
  onNavigateToFeed,
  editMode = false,
  editingItem = null,
  onItemUpdated,
  onCancelEdit,
  onShowToast,
}) => {
  // Core Fields (Pre-fills from editingItem if in edit mode)
  const [type, setType] = useState<ItemType | ''>(editingItem?.type || '');
  const [category, setCategory] = useState<ItemCategory | ''>(editingItem?.category || '');
  const [description, setDescription] = useState(editingItem?.description || '');
  const [location, setLocation] = useState(editingItem?.location || '');
  const [date, setDate] = useState(editingItem?.date || new Date().toISOString().split('T')[0]);

  // Image upload
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(editingItem?.photoUrl || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expandable verification question (for Found)
  const [showVerificationQuestion, setShowVerificationQuestion] = useState(
    Boolean(editingItem?.verificationQuestion)
  );
  const [verificationQuestion, setVerificationQuestion] = useState(
    editingItem?.verificationQuestion || ''
  );

  // Contact info
  const [contactName, setContactName] = useState(editingItem?.contactName || '');
  const [contactPhone, setContactPhone] = useState(editingItem?.contactPhone || '');
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Auto-fill contact info from device profile when creating new report
  React.useEffect(() => {
    if (!editMode) {
      profileService.getProfile().then((p) => {
        if (p.contactName) setContactName(p.contactName);
        if (p.contactPhone) setContactPhone(p.contactPhone);
      });
    }
  }, [editMode]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Feature States
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoAnalysisNotice, setPhotoAnalysisNotice] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(Boolean(editingItem?.aiGenerated));
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Record<string, boolean>>({});
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Privacy Guardian state ("حارس الخصوصية")
  const [privacyResult, setPrivacyResult] = useState<PrivacyReviewResult | null>(null);
  const [isReviewingPrivacy, setIsReviewingPrivacy] = useState(false);
  const [appliedRiskIndices, setAppliedRiskIndices] = useState<Set<number>>(new Set());
  const [ignoredRiskIndices, setIgnoredRiskIndices] = useState<Set<number>>(new Set());
  const [lastReviewedText, setLastReviewedText] = useState<string>('');
  const [confirmingHighRiskPublish, setConfirmingHighRiskPublish] = useState(false);

  // Photo Privacy state ("حارس خصوصية الصور")
  const [isCheckingPhotoPrivacy, setIsCheckingPhotoPrivacy] = useState(false);
  const [photoPrivacyResult, setPhotoPrivacyResult] = useState<ImagePrivacyResult | null>(null);
  const [isPhotoMasked, setIsPhotoMasked] = useState(false);
  const [confirmingBlockedPhotoPublish, setConfirmingBlockedPhotoPublish] = useState(false);

  const showToast = (message: string, toastType: 'success' | 'error' = 'success') => {
    if (typeof onShowToast === 'function') {
      onShowToast(message, toastType);
    }
  };

  const removeExcerpt = (source: string, excerpt: string): string => {
    if (!excerpt || !source) return source;
    const cleanExcerpt = excerpt.replace(/^["'«»\s]+|["'«»\s]+$/g, '');
    if (!cleanExcerpt) return source;
    const escaped = cleanExcerpt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`["'«»]?\\s*${escaped}\\s*["'«»]?`, 'gi');
    return source.replace(regex, ' ').replace(/\s{2,}/g, ' ').trim();
  };

  const runPrivacyReview = async (textToReview: string, force: boolean = false): Promise<PrivacyReviewResult | null> => {
    const trimmed = textToReview.trim();
    if (trimmed.length < 10) {
      setPrivacyResult(null);
      setAppliedRiskIndices(new Set());
      setIgnoredRiskIndices(new Set());
      setConfirmingHighRiskPublish(false);
      return null;
    }

    if (!force && lastReviewedText && Math.abs(trimmed.length - lastReviewedText.length) <= 10) {
      return privacyResult;
    }

    setIsReviewingPrivacy(true);
    try {
      const res = await aiService.reviewDescription(type, category, trimmed);
      if (res) {
        setPrivacyResult(res);
        setAppliedRiskIndices(new Set());
        setIgnoredRiskIndices(new Set());
        setLastReviewedText(trimmed);
        return res;
      }
    } catch (err) {
      console.warn('Privacy review non-blocking error:', err);
    } finally {
      setIsReviewingPrivacy(false);
    }
    return null;
  };

  // 800ms debounce after typing
  React.useEffect(() => {
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      setPrivacyResult(null);
      setAppliedRiskIndices(new Set());
      setIgnoredRiskIndices(new Set());
      setConfirmingHighRiskPublish(false);
      return;
    }

    const timer = setTimeout(() => {
      runPrivacyReview(trimmed, false);
    }, 800);

    return () => clearTimeout(timer);
  }, [description, type, category]);

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Post Submission Result & Matches
  const [createdItem, setCreatedItem] = useState<CampusItem | null>(null);
  const [postMatches, setPostMatches] = useState<AutoMatchResult[]>([]);

  // Focus & Scroll Helper
  const focusAndScrollToField = (fieldKey: string) => {
    const el = document.getElementById(`field-${fieldKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') {
        el.focus();
      }
    }
  };

  /* ---------------- Blur & Live Re-validation ---------------- */

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let error: string | null = null;

    switch (field) {
      case 'type':
        error = validateType(type);
        break;
      case 'category':
        error = validateCategory(category);
        break;
      case 'description':
        error = validateDescription(description);
        if (description.trim().length >= 10) {
          runPrivacyReview(description.trim(), true);
        }
        break;
      case 'location':
        error = validateLocation(location);
        break;
      case 'date':
        error = validateDate(date);
        break;
      case 'verificationQuestion':
        error = validateVerificationQuestion(verificationQuestion);
        break;
      case 'contactName':
        error = validateName(contactName);
        break;
      case 'contactPhone':
        error = validatePhone(contactPhone);
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

  const handleTypeChange = (selected: ItemType) => {
    setType(selected);
    if (touched.type) {
      const err = validateType(selected);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.type = err;
        else delete next.type;
        return next;
      });
    }
  };

  const handleCategoryChange = (val: string) => {
    const cat = val as ItemCategory | '';
    setCategory(cat);
    setAiSuggestedFields((prev) => ({ ...prev, category: false }));
    if (touched.category) {
      const err = validateCategory(cat);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.category = err;
        else delete next.category;
        return next;
      });
    }
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    setConfirmingHighRiskPublish(false);
    setAiSuggestedFields((prev) => ({ ...prev, description: false }));
    if (touched.description) {
      const err = validateDescription(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.description = err;
        else delete next.description;
        return next;
      });
    }
  };

  const handleLocationChange = (val: string) => {
    setLocation(val);
    if (touched.location) {
      const err = validateLocation(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.location = err;
        else delete next.location;
        return next;
      });
    }
  };

  const handleDateChange = (val: string) => {
    setDate(val);
    if (touched.date) {
      const err = validateDate(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.date = err;
        else delete next.date;
        return next;
      });
    }
  };

  const handleNameChange = (val: string) => {
    setContactName(val);
    if (touched.contactName) {
      const err = validateName(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.contactName = err;
        else delete next.contactName;
        return next;
      });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizePhoneNumber(raw);
    setContactPhone(normalized);

    if (touched.contactPhone) {
      const err = validatePhone(normalized);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.contactPhone = err;
        else delete next.contactPhone;
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

  const handleVerificationQuestionChange = (val: string) => {
    setVerificationQuestion(val);
    if (touched.verificationQuestion) {
      const err = validateVerificationQuestion(val);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next.verificationQuestion = err;
        else delete next.verificationQuestion;
        return next;
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileErr = validatePhotoFile(file);
    if (fileErr) {
      setErrors((prev) => ({ ...prev, photo: fileErr }));
      setTouched((prev) => ({ ...prev, photo: true }));
      return;
    }

    setPhotoFile(file);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const base64 = event.target.result;
        setPhotoDataUrl(base64);

        // Feature 1: Trigger analyze-photo automatically
        setIsAnalyzingPhoto(true);
        setPhotoAnalysisNotice(null);
        aiService
          .analyzePhoto(base64, (type as 'lost' | 'found') || 'found', 12000)
          .then((result) => {
            if (!result) return;
            if (result.lowConfidence) {
              setPhotoAnalysisNotice('ما قدرنا نحلل الصورة، اكتب الوصف يدوياً');
            } else {
              if (result.category) {
                setCategory(result.category);
                setAiSuggestedFields((prev) => ({ ...prev, category: true }));
              }
              if (result.description) {
                setDescription(result.description);
                setAiSuggestedFields((prev) => ({ ...prev, description: true }));
              }
              setAiGenerated(true);
              setPhotoAnalysisNotice(null);

              // Reinforce after first use: one-time toast per browser
              try {
                const hasSeenPhotoToast = localStorage.getItem('taman:seen_photo_analyzed_toast');
                if (!hasSeenPhotoToast) {
                  localStorage.setItem('taman:seen_photo_analyzed_toast', 'true');
                  onShowToast?.('كتبنا الوصف من صورتك — عدّله كما تحب', 'success');
                }
              } catch (storageErr) {
                console.warn('Storage error on photo toast:', storageErr);
              }
            }
          })
          .catch((err) => {
            console.warn('Photo analysis non-blocking error:', err);
          })
          .finally(() => {
            setIsAnalyzingPhoto(false);
          });

        // Feature: Image Privacy Check
        setIsCheckingPhotoPrivacy(true);
        setPhotoPrivacyResult(null);
        setIsPhotoMasked(false);
        setConfirmingBlockedPhotoPublish(false);

        aiService
          .checkPhotoPrivacy(base64, 12000)
          .then((privacy) => {
            setPhotoPrivacyResult(privacy);
            if (privacy.is_identity_document || privacy.recommendation === 'block') {
              // Automatically switch category to student_id if it was an identity card
              if (
                privacy.document_type === 'university_id' ||
                privacy.document_type === 'national_id' ||
                privacy.document_type === 'iqama'
              ) {
                setCategory('student_id');
                setAiSuggestedFields((prev) => ({ ...prev, category: true }));
              }
            }
          })
          .catch((err) => {
            console.warn('Photo privacy check non-blocking error:', err);
            setPhotoPrivacyResult({
              is_identity_document: false,
              document_type: 'none',
              visible_sensitive_fields: [],
              recommendation: 'allow',
              fallbackNotice: 'تأكد أن الصورة لا تُظهر أرقام هويتك.',
            });
          })
          .finally(() => {
            setIsCheckingPhotoPrivacy(false);
          });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setPhotoDataUrl(null);
    setPhotoFile(null);
    setIsAnalyzingPhoto(false);
    setIsCheckingPhotoPrivacy(false);
    setPhotoAnalysisNotice(null);
    setPhotoPrivacyResult(null);
    setIsPhotoMasked(false);
    setConfirmingBlockedPhotoPublish(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
  };

  const handlePublishWithoutPhoto = () => {
    setPhotoDataUrl(null);
    setPhotoFile(null);
    setIsCheckingPhotoPrivacy(false);
    setPhotoAnalysisNotice(null);
    setConfirmingBlockedPhotoPublish(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const defaultQ = 'ما هما آخر رقمين في البطاقة؟';
    const suggestedQ = photoPrivacyResult?.suggested_verification_question || defaultQ;
    setVerificationQuestion(suggestedQ);
    setShowVerificationQuestion(true);
    if (!category) {
      setCategory('student_id');
      setAiSuggestedFields((prev) => ({ ...prev, category: true }));
    }
    if (touched.verificationQuestion) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.verificationQuestion;
        return next;
      });
    }
    setPhotoPrivacyResult(null);
    showToast('حذفنا الصورة لحماية هويتك ونقلنا التفاصيل إلى سؤال التحقق.', 'success');
  };

  const handleMaskSensitivePhoto = async () => {
    if (!photoDataUrl) return;
    try {
      const masked = await maskSensitivePhoto(photoDataUrl);
      setPhotoDataUrl(masked);
      const maskedFile = dataUrlToFile(masked, photoFile?.name || 'masked_photo.jpg');
      setPhotoFile(maskedFile);
      setIsPhotoMasked(true);
      showToast('تم إخفاء التفاصيل الحساسة من الصورة بنجاح.', 'success');
    } catch (err) {
      console.warn('Failed masking sensitive photo:', err);
    }
  };

  const handleSuggestQuestions = async () => {
    if (!description || description.trim().length < 5) return;
    setIsLoadingQuestions(true);
    try {
      const qs = await aiService.suggestVerificationQuestions(description.trim(), category ? String(category) : undefined);
      setSuggestedQuestions(qs);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleSelectSuggestedQuestion = (q: string) => {
    setVerificationQuestion(q);
    if (touched.verificationQuestion) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.verificationQuestion;
        return next;
      });
    }
  };

  /* ---------------- Submit Handler ---------------- */

  const handleSubmit = async (e?: React.FormEvent, skipHighRiskCheck: boolean = false) => {
    if (e) {
      e.preventDefault();
    }

    const validation = validateItemForm({
      type,
      category,
      description,
      location,
      date,
      contactName,
      contactPhone,
      verificationQuestion: type === 'found' ? verificationQuestion : undefined,
      photoFile,
    });

    if (!validation.isValid) {
      const allTouched: Record<string, boolean> = {
        type: true,
        category: true,
        description: true,
        location: true,
        date: true,
        contactName: true,
        contactPhone: true,
      };
      if (type === 'found' && verificationQuestion) {
        allTouched.verificationQuestion = true;
      }
      if (photoFile) {
        allTouched.photo = true;
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

    // Feature: حارس الخصوصية — check photo before publishing
    const isPhotoBlocked =
      photoPrivacyResult &&
      (photoPrivacyResult.is_identity_document || photoPrivacyResult.recommendation === 'block');

    if (!skipHighRiskCheck && isPhotoBlocked && photoDataUrl) {
      setConfirmingBlockedPhotoPublish(true);
      focusAndScrollToField('photo');
      return;
    }
    setConfirmingBlockedPhotoPublish(false);

    // Feature: حارس الخصوصية — check description before publishing
    if (!skipHighRiskCheck) {
      const trimmedDesc = description.trim();
      let currentResult = privacyResult;
      if (trimmedDesc.length >= 10 && (!currentResult || lastReviewedText !== trimmedDesc)) {
        currentResult = await runPrivacyReview(trimmedDesc, true);
      }

      if (currentResult && Array.isArray(currentResult.risks)) {
        const unhandledHighRisks = currentResult.risks.filter(
          (r, i) => r.severity === 'high' && !appliedRiskIndices.has(i) && !ignoredRiskIndices.has(i)
        );
        if (unhandledHighRisks.length > 0) {
          setConfirmingHighRiskPublish(true);
          return;
        }
      }
    }

    setConfirmingHighRiskPublish(false);

    const categoryObj = CATEGORIES.find((c) => c.id === category);
    const categoryName = categoryObj?.labelAr || 'غرض جامعي';
    const autoTitle =
      description.length > 35
        ? `${categoryName} — ${description.slice(0, 32)}...`
        : `${categoryName} — ${description}`;

    // Never store original image when the check says block
    const finalPhotoUrl = isPhotoBlocked ? undefined : (photoDataUrl || undefined);

    const newItemData: Omit<CampusItem, 'id' | 'createdAt' | 'status'> = {
      type: type as ItemType,
      title: autoTitle,
      category: category as ItemCategory,
      location,
      date,
      description: description.trim(),
      photoUrl: finalPhotoUrl,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      verificationQuestion:
        type === 'found' && verificationQuestion.trim()
          ? verificationQuestion.trim()
          : undefined,
      aiGenerated: aiGenerated || undefined,
    };

    setIsSubmitting(true);
    try {
      if (editMode && editingItem && onItemUpdated) {
        await onItemUpdated({
          ...editingItem,
          ...newItemData,
          title: autoTitle,
        });
      } else {
        const created = await onItemCreated(newItemData);
        if (created) {
          setCreatedItem(created);
          // Feature 2: Hybrid semantic matching
          const matches = await aiService.findHybridMatches(created, existingItems);
          setPostMatches(matches);
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setCreatedItem(null);
    setPostMatches([]);
    setType('');
    setCategory('');
    setDescription('');
    setLocation('');
    setDate(new Date().toISOString().split('T')[0]);
    setPhotoDataUrl(null);
    setPhotoFile(null);
    setIsAnalyzingPhoto(false);
    setIsCheckingPhotoPrivacy(false);
    setPhotoAnalysisNotice(null);
    setPhotoPrivacyResult(null);
    setIsPhotoMasked(false);
    setConfirmingBlockedPhotoPublish(false);
    setAiGenerated(false);
    setAiSuggestedFields({});
    setSuggestedQuestions([]);
    setVerificationQuestion('');
    setShowVerificationQuestion(false);
    setContactName('');
    setContactPhone('');
    setErrors({});
    setTouched({});
    setSummaryError(null);
  };

  const isFieldInvalid = (fieldName: string) => touched[fieldName] && Boolean(errors[fieldName]);
  const isFieldValidAfterBlur = (fieldName: string) => touched[fieldName] && !errors[fieldName];
  const isPhoneLiveValid = contactPhone.length === VALIDATION_LIMITS.phone.exactLength && contactPhone.startsWith(VALIDATION_LIMITS.phone.prefix);
  const hasClaims = Boolean(editingItem?.claims && editingItem.claims.length > 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 w-full min-w-0">
      {/* Top Header with Back Arrow */}
      <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)] min-w-0 w-full">
        {editMode && confirmingCancel ? (
          <div className="flex items-center gap-3 min-w-0 w-full justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-[#FF6B7A] font-bold">تجاهل التعديلات والعودة؟</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="min-h-[36px] px-4 rounded-full bg-[#FF6B7A] text-white font-bold text-[13px] hover:bg-[#FF6B7A]/90 transition-colors cursor-pointer"
              >
                نعم، تجاهل
              </button>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="min-h-[36px] px-3 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] border border-[rgba(255,255,255,0.08)] text-[13px] transition-colors cursor-pointer"
              >
                متابعة التعديل
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (editMode) {
                  setConfirmingCancel(true);
                } else {
                  onNavigateToFeed();
                }
              }}
              aria-label={STRINGS_AR.post.backAria}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#16191F] text-[#F2F5F9] hover:bg-[#16191F] hover:border-[#4D9BFF] transition-colors focus-visible:ring-2 focus-visible:ring-[#4D9BFF] cursor-pointer shrink-0"
            >
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-[26px] sm:text-[28px] font-bold text-[#F2F5F9]">
                {editMode ? 'تعديل البلاغ' : STRINGS_AR.post.title}
              </h1>
              <p className="text-[14px] text-[#B4BECB]">
                {editMode ? 'تحديث البيانات وحفظ التغييرات في قاعدة البيانات' : STRINGS_AR.post.subtitle}
              </p>
            </div>
          </div>
        )}
      </div>

      {!createdItem ? (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-6 sm:p-8 space-y-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        >
          {/* Summary Line above form if submit failed */}
          {summaryError && (
            <div
              role="alert"
              className="p-4 rounded-full bg-[#FF6B7A]/10 border border-[#FF6B7A] text-[#FF6B7A] flex items-center gap-2.5 text-[15px] font-bold"
            >
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{summaryError}</span>
            </div>
          )}

          {/* 1. نوع البلاغ */}
          <div id="field-type" tabIndex={-1} className="space-y-1.5 focus:outline-none">
            <div className="flex items-center justify-between">
              <label className="text-[15px] font-semibold text-[#F2F5F9] flex items-center gap-2">
                <span>{STRINGS_AR.fields.type.label}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                  {STRINGS_AR.chips.required}
                </span>
              </label>
            </div>

            <div
              className={`grid grid-cols-2 gap-3 p-1.5 bg-[#16191F] rounded-full border transition-all ${
                isFieldInvalid('type')
                  ? 'border-2 border-[#FF6B7A]'
                  : isFieldValidAfterBlur('type')
                  ? 'border-[#4D9BFF]'
                  : 'border-[rgba(255,255,255,0.08)]'
              }`}
            >
              <button
                type="button"
                disabled={editMode && hasClaims}
                onClick={() => !hasClaims && handleTypeChange('lost')}
                onBlur={() => handleBlur('type')}
                className={`min-h-[44px] py-2 px-4 rounded-full text-[15px] font-semibold transition-all ${
                  editMode && hasClaims
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  type === 'lost'
                    ? 'bg-[#2F6BFF] text-white shadow-[0_0_12px_rgba(47,107,255,0.35)]'
                    : 'text-[#B4BECB] hover:text-[#F2F5F9]'
                }`}
              >
                {STRINGS_AR.fields.type.lostOption}
              </button>

              <button
                type="button"
                disabled={editMode && hasClaims}
                onClick={() => !hasClaims && handleTypeChange('found')}
                onBlur={() => handleBlur('type')}
                className={`min-h-[44px] py-2 px-4 rounded-full text-[15px] font-semibold transition-all ${
                  editMode && hasClaims
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  type === 'found'
                    ? 'bg-[#2F6BFF] text-white shadow-[0_0_12px_rgba(47,107,255,0.35)]'
                    : 'text-[#B4BECB] hover:text-[#F2F5F9]'
                }`}
              >
                {STRINGS_AR.fields.type.foundOption}
              </button>
            </div>

            {editMode && hasClaims ? (
              <p className="text-[13px] text-[#FFB84D] font-medium pt-1">
                لا يمكن تغيير النوع بعد وجود طلب استرداد
              </p>
            ) : (
              <p className="text-[13px] text-[#B4BECB]">
                {STRINGS_AR.fields.type.helper}
              </p>
            )}

            {isFieldInvalid('type') && (
              <p
                id="error-type"
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.type}</span>
              </p>
            )}
          </div>

          {/* Photo Dropzone: Visual focal point of the form */}
          <div id="field-photo" tabIndex={-1} className="space-y-2 focus:outline-none pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
              id="image-file-input"
            />

            {!photoDataUrl ? (
              <label
                htmlFor="image-file-input"
                className={`cursor-pointer group flex flex-col items-center justify-center p-8 sm:p-10 border-2 border-dashed rounded-[24px] bg-[#16191F]/90 hover:bg-[#16191F] transition-all gap-3.5 min-h-[190px] sm:min-h-[220px] text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
                  isFieldInvalid('photo')
                    ? 'border-[#FF6B7A] bg-[#FF6B7A]/5'
                    : 'border-[#4D9BFF]/35 hover:border-[#4D9BFF] hover:shadow-[0_0_24px_rgba(77,155,255,0.15)]'
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#101216] border border-[#4D9BFF]/30 group-hover:border-[#4D9BFF] group-hover:scale-105 flex items-center justify-center text-[#4D9BFF] transition-all shadow-[0_0_16px_rgba(77,155,255,0.18)]">
                  <Camera className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden="true" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <div className="text-[17px] sm:text-[19px] font-bold text-[#F2F5F9] flex items-center justify-center gap-2 flex-wrap leading-tight">
                    <span>صوّر الغرض وخلّ تأمن يكتب الوصف عنك</span>
                    <AiSparkleChip />
                  </div>
                  <p className="text-[14px] text-[#B4BECB]">
                    اختياري — تقدر تكتب الوصف بنفسك
                  </p>
                </div>

                <div className="text-[12px] text-[#B4BECB]/70 font-medium pt-1 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#4D9BFF]" />
                  <span>{STRINGS_AR.fields.photo.supportedTypes}</span>
                </div>
              </label>
            ) : (
              <>
                <div className="relative rounded-[22px] overflow-hidden border border-[rgba(255,255,255,0.1)] bg-[#16191F] p-4 flex flex-col sm:flex-row items-center gap-4 min-h-[120px]">
                <img
                  src={photoDataUrl}
                  alt={STRINGS_AR.fields.photo.attachedSuccess}
                  className="w-22 h-22 sm:w-24 sm:h-24 object-cover rounded-xl border border-[rgba(255,255,255,0.1)] shrink-0"
                />
                <div className="flex-1 min-w-0 text-center sm:text-right space-y-1.5">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="text-[15px] font-bold text-[#F2F5F9]">
                      {STRINGS_AR.fields.photo.attachedSuccess}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                      مُرفقة
                    </span>
                  </div>

                  {isAnalyzingPhoto || isCheckingPhotoPrivacy ? (
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <div className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#4D9BFF] animate-pulse">
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>
                          {isCheckingPhotoPrivacy
                            ? 'جارٍ فحص الصورة…'
                            : 'جارٍ تحليل الصورة وكتابة الوصف…'}
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-[#4D9BFF]/20 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-[#4D9BFF] animate-pulse" />
                      </div>
                    </div>
                  ) : photoAnalysisNotice ? (
                    <span className="text-[12px] text-[#FFB84D] block font-medium">
                      {photoAnalysisNotice}
                    </span>
                  ) : (
                    <p className="text-[13px] text-[#B4BECB] flex items-center justify-center sm:justify-start gap-1">
                      <span>تم استخراج الوصف والفئة من الصورة بنجاح</span>
                      <AiSparkleChip />
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="image-file-input"
                    className="min-h-[44px] px-3.5 py-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[#101216] text-[13px] font-medium text-[#4D9BFF] hover:border-[#4D9BFF] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>تغيير</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label={STRINGS_AR.fields.photo.removeAria}
                    className="min-h-[44px] min-w-[44px] rounded-full border border-[rgba(255,255,255,0.12)] bg-[#101216] text-[#FF6B7A] hover:bg-[#FF6B7A]/10 hover:border-[#FF6B7A] flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Photo Privacy Guardian Alerts */}
              {photoPrivacyResult?.fallbackNotice && (
                <p className="text-[12.5px] text-[#FFB84D] font-medium flex items-center gap-1.5 pt-1">
                  <Shield className="w-4 h-4 shrink-0 text-[#FFB84D]" />
                  <span>{photoPrivacyResult.fallbackNotice}</span>
                </p>
              )}

              {/* Identity Document Block Panel */}
              {photoPrivacyResult &&
                (photoPrivacyResult.is_identity_document ||
                  photoPrivacyResult.recommendation === 'block') && (
                  <div className="p-4 sm:p-5 rounded-[20px] bg-[#101216] border border-[#FFB84D]/35 space-y-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] text-right">
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-5 h-5 text-[#FFB84D] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-[15px] font-bold text-[#FFB84D]">
                          الصورة تحتوي وثيقة هوية — لا تنشرها
                        </h4>
                        <p className="text-[13px] text-[#B4BECB] leading-relaxed">
                          يكفي أن تذكر نوع البطاقة وآخر رقمين، والباقي يصير سؤال تحقق.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="min-h-[44px] px-4 py-2 rounded-full bg-[#16191F] border border-[#FF6B7A]/40 text-[#FF6B7A] hover:bg-[#FF6B7A]/10 text-[13px] font-semibold transition-all cursor-pointer"
                      >
                        احذف الصورة
                      </button>
                      <button
                        type="button"
                        onClick={handlePublishWithoutPhoto}
                        className="min-h-[44px] px-4.5 py-2 rounded-full bg-[#4D9BFF]/20 border border-[#4D9BFF]/50 text-[#4D9BFF] hover:bg-[#4D9BFF]/30 text-[13px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-[0_0_12px_rgba(77,155,255,0.2)]"
                      >
                        <span>انشر بدون صورة</span>
                        <AiSparkleChip />
                      </button>
                    </div>
                  </div>
                )}

              {/* Sensitive Personal Text Mask Offer */}
              {photoPrivacyResult &&
                !photoPrivacyResult.is_identity_document &&
                photoPrivacyResult.recommendation === 'mask' && (
                  <div className="p-3.5 sm:p-4 rounded-[18px] bg-[#101216] border border-[#FFB84D]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-[#FFB84D] shrink-0" />
                      <span className="text-[13px] text-[#F2F5F9]">
                        {isPhotoMasked
                          ? 'تم إخفاء التفاصيل الحساسة من الصورة بنجاح ✓'
                          : 'تحتوي الصورة على تفاصيل شخصية مقروءة (اسم أو رقم). يُنصح بإخفائها.'}
                      </span>
                    </div>
                    {!isPhotoMasked && (
                      <button
                        type="button"
                        onClick={handleMaskSensitivePhoto}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-full bg-[#4D9BFF]/20 border border-[#4D9BFF]/40 text-[#4D9BFF] hover:bg-[#4D9BFF]/30 text-[13px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <span>أخفِ التفاصيل الحساسة</span>
                        <AiSparkleChip />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {isFieldInvalid('photo') && (
              <p
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.photo}</span>
              </p>
            )}
          </div>

          {/* 2. الفئة */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="field-category"
                  className="text-[15px] font-semibold text-[#F2F5F9]"
                >
                  {STRINGS_AR.fields.category.label}
                </label>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                  {STRINGS_AR.chips.required}
                </span>
                {aiSuggestedFields.category && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-bold bg-[#4D9BFF]/20 text-[#4D9BFF] border border-[#4D9BFF]/40 gap-1 select-none">
                    <span>اقتراح ذكي</span>
                    <span>✨</span>
                  </span>
                )}
              </div>
            </div>

            <div className="relative">
              <select
                id="field-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                onBlur={() => handleBlur('category')}
                aria-invalid={isFieldInvalid('category') ? 'true' : 'false'}
                aria-describedby={isFieldInvalid('category') ? 'error-category' : undefined}
                className={`w-full min-h-[48px] px-5 py-3 rounded-full bg-[#16191F] text-[16px] text-[#F2F5F9] font-medium transition-all focus:outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
                  isFieldInvalid('category')
                    ? 'border-2 border-[#FF6B7A]'
                    : isFieldValidAfterBlur('category')
                    ? 'border-2 border-[#4D9BFF]'
                    : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                }`}
              >
                <option value="" className="bg-[#101216] text-[#B4BECB]">{STRINGS_AR.fields.category.defaultOption}</option>
                {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-[#101216] text-[#F2F5F9]">
                    {cat.labelAr}
                  </option>
                ))}
              </select>

              {isFieldInvalid('category') && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-[#FF6B7A]">
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
              {isFieldValidAfterBlur('category') && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-[#4D9BFF]">
                  <Check className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
            </div>

            <p className="text-[13px] text-[#B4BECB]">
              {STRINGS_AR.fields.category.helper}
            </p>

            {isFieldInvalid('category') && (
              <p
                id="error-category"
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.category}</span>
              </p>
            )}
          </div>

          {/* 3. الوصف */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="field-description"
                  className="text-[15px] font-semibold text-[#F2F5F9]"
                >
                  {STRINGS_AR.fields.description.label}
                </label>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                  {STRINGS_AR.chips.required}
                </span>
                {aiSuggestedFields.description && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-bold bg-[#4D9BFF]/20 text-[#4D9BFF] border border-[#4D9BFF]/40 gap-1 select-none">
                    <span>اقتراح ذكي</span>
                    <span>✨</span>
                  </span>
                )}
              </div>

              {/* Live Counter */}
              <span className="text-[13px] font-mono text-[#B4BECB] font-semibold">
                {STRINGS_AR.fields.description.counter(description.length, VALIDATION_LIMITS.description.max)}
              </span>
            </div>

            <div className="relative">
              <textarea
                id="field-description"
                rows={3}
                placeholder={STRINGS_AR.fields.description.placeholder}
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={() => handleBlur('description')}
                aria-invalid={isFieldInvalid('description') ? 'true' : 'false'}
                aria-describedby={isFieldInvalid('description') ? 'error-description' : undefined}
                className={`w-full min-h-[48px] px-5 py-3 rounded-[20px] bg-[#16191F] text-[16px] text-[#F2F5F9] leading-[1.6] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
                  isFieldInvalid('description')
                    ? 'border-2 border-[#FF6B7A]'
                    : isFieldValidAfterBlur('description')
                    ? 'border-2 border-[#4D9BFF]'
                    : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                }`}
              />

              {isFieldInvalid('description') && (
                <div className="absolute left-3 top-3 text-[#FF6B7A] pointer-events-none">
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
            </div>

            {aiGenerated && (
              <p className="text-[13px] text-[#4D9BFF] flex items-center gap-1.5 pt-0.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>راجع الوصف قبل النشر</span>
              </p>
            )}

            <p className="text-[13px] text-[#B4BECB]">
              {STRINGS_AR.fields.description.helper}
            </p>

            {isFieldInvalid('description') && (
              <p
                id="error-description"
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.description}</span>
              </p>
            )}

            {/* Inline Privacy Guardian Panel ("حارس الخصوصية") */}
            {(privacyResult || isReviewingPrivacy) && (
              <div className="pt-2">
                <PrivacyGuardianPanel
                  risks={privacyResult?.risks || []}
                  appliedIndices={appliedRiskIndices}
                  ignoredIndices={ignoredRiskIndices}
                  isReviewing={isReviewingPrivacy}
                  onRemoveExcerpt={(excerpt, index) => {
                    const updated = removeExcerpt(description, excerpt);
                    setDescription(updated);
                    setAppliedRiskIndices((prev) => new Set([...prev, index]));
                    if (touched.description) {
                      const err = validateDescription(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (err) next.description = err;
                        else delete next.description;
                        return next;
                      });
                    }
                    showToast('تم حذف التفصيل من الوصف.', 'success');
                  }}
                  onMoveToVerification={(excerpt, index) => {
                    const updated = removeExcerpt(description, excerpt);
                    setDescription(updated);
                    setAppliedRiskIndices((prev) => new Set([...prev, index]));

                    const q =
                      privacyResult?.suggested_verification_question ||
                      `ما هي العلامة أو التفصيل الخاص بالغرض؟`;
                    setVerificationQuestion(q);
                    setShowVerificationQuestion(true);
                    if (touched.verificationQuestion) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.verificationQuestion;
                        return next;
                      });
                    }
                    showToast(
                      'نقلناه إلى سؤال التحقق — صار دليل ملكيتك بدل ما يكون معلومة عامة.',
                      'success'
                    );
                  }}
                  onApplyAll={() => {
                    if (privacyResult) {
                      if (privacyResult.safe_description) {
                        setDescription(privacyResult.safe_description);
                      }
                      if (
                        privacyResult.suggested_verification_question &&
                        (!verificationQuestion || verificationQuestion.trim().length === 0)
                      ) {
                        setVerificationQuestion(privacyResult.suggested_verification_question);
                        setShowVerificationQuestion(true);
                      }
                      setAppliedRiskIndices(new Set(privacyResult.risks.map((_, i) => i)));
                      setConfirmingHighRiskPublish(false);
                      showToast('تم تطبيق كل الاقتراحات الآمنة.', 'success');
                    }
                  }}
                  onIgnoreRisk={(index) => {
                    setIgnoredRiskIndices((prev) => new Set([...prev, index]));
                  }}
                />
              </div>
            )}
          </div>

          {/* 4. الموقع */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="field-location"
                className="text-[15px] font-semibold text-[#F2F5F9] flex items-center gap-2"
              >
                <span>{STRINGS_AR.fields.location.label}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                  {STRINGS_AR.chips.required}
                </span>
              </label>
            </div>

            <div className="relative">
              <select
                id="field-location"
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
                onBlur={() => handleBlur('location')}
                aria-invalid={isFieldInvalid('location') ? 'true' : 'false'}
                aria-describedby={isFieldInvalid('location') ? 'error-location' : undefined}
                className={`w-full min-h-[48px] px-5 py-3 rounded-full bg-[#16191F] text-[16px] text-[#F2F5F9] font-medium transition-all focus:outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
                  isFieldInvalid('location')
                    ? 'border-2 border-[#FF6B7A]'
                    : isFieldValidAfterBlur('location')
                    ? 'border-2 border-[#4D9BFF]'
                    : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                }`}
              >
                <option value="" className="bg-[#101216] text-[#B4BECB]">{STRINGS_AR.fields.location.defaultOption}</option>
                {CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc} className="bg-[#101216] text-[#F2F5F9]">
                    {loc}
                  </option>
                ))}
              </select>

              {isFieldInvalid('location') && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-[#FF6B7A]">
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
              {isFieldValidAfterBlur('location') && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-[#4D9BFF]">
                  <Check className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
            </div>

            <p className="text-[13px] text-[#B4BECB]">
              {STRINGS_AR.fields.location.helper}
            </p>

            {isFieldInvalid('location') && (
              <p
                id="error-location"
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.location}</span>
              </p>
            )}
          </div>

          {/* 5. التاريخ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="field-date"
                className="text-[15px] font-semibold text-[#F2F5F9] flex items-center gap-2"
              >
                <span>{STRINGS_AR.fields.date.label}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#4D9BFF]/15 text-[#4D9BFF]">
                  {STRINGS_AR.chips.required}
                </span>
              </label>
            </div>

            <div className="relative">
              <input
                id="field-date"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                onBlur={() => handleBlur('date')}
                aria-invalid={isFieldInvalid('date') ? 'true' : 'false'}
                aria-describedby={isFieldInvalid('date') ? 'error-date' : undefined}
                className={`w-full min-h-[48px] px-5 py-3 rounded-full bg-[#16191F] text-[16px] font-mono text-[#F2F5F9] transition-all focus:outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
                  isFieldInvalid('date')
                    ? 'border-2 border-[#FF6B7A]'
                    : isFieldValidAfterBlur('date')
                    ? 'border-2 border-[#4D9BFF]'
                    : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                }`}
              />

              {isFieldInvalid('date') && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none text-[#FF6B7A]">
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                </div>
              )}
            </div>

            <p className="text-[13px] text-[#B4BECB]">
              {STRINGS_AR.fields.date.helper}
            </p>

            {isFieldInvalid('date') && (
              <p
                id="error-date"
                role="alert"
                className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5 pt-0.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errors.date}</span>
              </p>
            )}
          </div>

          {/* سؤال التحقق (اختياري، يظهر عند اختيار "موجود") */}
          {type === 'found' && (
            <div className="rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#16191F] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowVerificationQuestion((prev) => !prev)}
                className="w-full p-4 flex items-center justify-between text-right hover:bg-[#101216]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-[#F2F5F9]">
                    {STRINGS_AR.fields.verificationQuestion.toggleTitle}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[rgba(255,255,255,0.08)] text-[#B4BECB]">
                    {STRINGS_AR.chips.optional}
                  </span>
                </div>
                {showVerificationQuestion ? (
                  <ChevronUp className="w-5 h-5 text-[#4D9BFF]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#4D9BFF]" />
                )}
              </button>

              {showVerificationQuestion && (
                <div id="field-verificationQuestion" className="p-4 pt-1 border-t border-[rgba(255,255,255,0.08)] space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={verificationQuestion}
                      onChange={(e) => handleVerificationQuestionChange(e.target.value)}
                      onBlur={() => handleBlur('verificationQuestion')}
                      placeholder={STRINGS_AR.fields.verificationQuestion.placeholder}
                      aria-invalid={isFieldInvalid('verificationQuestion') ? 'true' : 'false'}
                      aria-describedby={isFieldInvalid('verificationQuestion') ? 'error-verificationQuestion' : undefined}
                      className={`w-full min-h-[48px] px-5 py-3 text-[16px] rounded-full bg-[#101216] text-[#F2F5F9] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none ${
                        isFieldInvalid('verificationQuestion')
                          ? 'border-2 border-[#FF6B7A]'
                          : isFieldValidAfterBlur('verificationQuestion')
                          ? 'border-2 border-[#4D9BFF]'
                          : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                      }`}
                    />

                    {isFieldInvalid('verificationQuestion') && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF6B7A] pointer-events-none">
                        <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Feature 3: Smart Question Suggestions */}
                  {description.trim().length >= 10 && (
                    <div className="pt-0.5 space-y-2">
                      <button
                        type="button"
                        disabled={isLoadingQuestions}
                        onClick={handleSuggestQuestions}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#101216] border border-[#4D9BFF]/40 text-[#4D9BFF] hover:bg-[#4D9BFF]/10 text-[13px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isLoadingQuestions ? 'جارٍ اقتراح الأسئلة…' : 'اقترح سؤال تحقق ✨'}</span>
                      </button>

                      {suggestedQuestions.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-1 w-full">
                          {suggestedQuestions.map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectSuggestedQuestion(q)}
                              className="w-full sm:w-auto flex-1 min-h-[44px] px-4 py-2.5 rounded-[14px] bg-[#101216] border border-[#4D9BFF]/30 hover:border-[#4D9BFF] text-[#F2F5F9] text-[13px] text-right font-medium transition-all cursor-pointer hover:bg-[#4D9BFF]/5 active:scale-[0.99] flex items-center gap-2"
                            >
                              <span className="text-[#4D9BFF] shrink-0 font-bold">✨</span>
                              <span className="line-clamp-2">{q}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[13px] text-[#B4BECB]">
                    {STRINGS_AR.fields.verificationQuestion.helper}
                  </p>

                  {isFieldInvalid('verificationQuestion') && (
                    <p
                      id="error-verificationQuestion"
                      role="alert"
                      className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{errors.verificationQuestion}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Compact Final Contact Block */}
          <div className="p-5 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-[#F2F5F9]">
                {STRINGS_AR.fields.contactBlock.title}
              </span>
              <span className="text-[13px] text-[#B4BECB] flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-[#4D9BFF]" aria-hidden="true" />
                <span>{STRINGS_AR.fields.contactBlock.privacyBadge}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* الاسم الكامل */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="field-contactName"
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
                    id="field-contactName"
                    type="text"
                    placeholder={STRINGS_AR.fields.name.placeholder}
                    value={contactName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => handleBlur('contactName')}
                    aria-invalid={isFieldInvalid('contactName') ? 'true' : 'false'}
                    aria-describedby={isFieldInvalid('contactName') ? 'error-contactName' : undefined}
                    className={`w-full min-h-[48px] px-5 py-3 text-[16px] rounded-full bg-[#101216] text-[#F2F5F9] placeholder:text-[#B4BECB]/40 transition-all focus:outline-none ${
                      isFieldInvalid('contactName')
                        ? 'border-2 border-[#FF6B7A]'
                        : isFieldValidAfterBlur('contactName')
                        ? 'border-2 border-[#4D9BFF]'
                        : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                    }`}
                  />

                  {isFieldInvalid('contactName') && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FF6B7A] pointer-events-none">
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                  {isFieldValidAfterBlur('contactName') && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4D9BFF] pointer-events-none">
                      <Check className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <p className="text-[12px] text-[#B4BECB]">
                  {STRINGS_AR.fields.name.helper}
                </p>

                {isFieldInvalid('contactName') && (
                  <p
                    id="error-contactName"
                    role="alert"
                    className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{errors.contactName}</span>
                  </p>
                )}
              </div>

              {/* رقم الجوال */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="field-contactPhone"
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
                    id="field-contactPhone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={VALIDATION_LIMITS.phone.exactLength}
                    placeholder={STRINGS_AR.fields.phone.placeholder}
                    value={contactPhone}
                    onChange={handlePhoneChange}
                    onKeyDown={handlePhoneKeyDown}
                    onBlur={() => handleBlur('contactPhone')}
                    aria-invalid={isFieldInvalid('contactPhone') ? 'true' : 'false'}
                    aria-describedby={isFieldInvalid('contactPhone') ? 'error-contactPhone' : undefined}
                    className={`w-full min-h-[48px] px-5 py-3 text-[16px] font-mono text-[#F2F5F9] bg-[#101216] rounded-full placeholder:text-[#B4BECB]/40 transition-all focus:outline-none ${
                      isFieldInvalid('contactPhone')
                        ? 'border-2 border-[#FF6B7A]'
                        : isPhoneLiveValid
                        ? 'border-2 border-[#4D9BFF]'
                        : 'border border-[rgba(255,255,255,0.08)] focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF]'
                    }`}
                  />

                  {isPhoneLiveValid && !isFieldInvalid('contactPhone') && (
                    <div
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4D9BFF] pointer-events-none"
                      aria-label={STRINGS_AR.fields.phone.validLiveAria}
                    >
                      <Check className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                    </div>
                  )}

                  {isFieldInvalid('contactPhone') && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FF6B7A] pointer-events-none">
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <p className="text-[12px] text-[#B4BECB]">
                  {STRINGS_AR.fields.phone.helper}
                </p>

                {isFieldInvalid('contactPhone') && (
                  <p
                    id="error-contactPhone"
                    role="alert"
                    className="text-[13px] text-[#FF6B7A] font-semibold flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{errors.contactPhone}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Primary Action Button & Cancel (Pill) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {confirmingBlockedPhotoPublish ? (
              <div className="w-full min-h-[48px] p-3 px-4 rounded-full bg-[#16191F] border border-[#FFB84D]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_16px_rgba(255,184,77,0.15)]">
                <span className="text-[13.5px] text-[#FFB84D] font-bold text-center sm:text-right">
                  الصورة تحتوي وثيقة هوية ولن يتم نشرها. المتابعة بدون صورة؟
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingBlockedPhotoPublish(false);
                      setPhotoDataUrl(null);
                      setPhotoFile(null);
                      setPhotoPrivacyResult(null);
                      handleSubmit(undefined, true);
                    }}
                    className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#2F6BFF] hover:bg-[#2F6BFF]/90 text-white font-bold text-[13px] cursor-pointer transition-colors shadow-[0_0_10px_rgba(47,107,255,0.3)]"
                  >
                    نشر بدون صورة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingBlockedPhotoPublish(false);
                      focusAndScrollToField('photo');
                    }}
                    className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.12)] text-[#F2F5F9] hover:bg-[#16191F] font-semibold text-[13px] cursor-pointer transition-colors"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            ) : confirmingHighRiskPublish ? (
              <div className="w-full min-h-[48px] p-3 px-4 rounded-full bg-[#16191F] border border-[#FFB84D]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_16px_rgba(255,184,77,0.15)]">
                <span className="text-[13.5px] text-[#FFB84D] font-bold text-center sm:text-right">
                  الوصف يحتوي بيانات شخصية. النشر على أي حال؟
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingHighRiskPublish(false);
                      handleSubmit(undefined, true);
                    }}
                    className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#FF6B7A] hover:bg-[#FF6B7A]/90 text-white font-bold text-[13px] cursor-pointer transition-colors shadow-[0_0_10px_rgba(255,107,122,0.3)]"
                  >
                    نشر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingHighRiskPublish(false);
                      focusAndScrollToField('description');
                    }}
                    className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#101216] border border-[rgba(255,255,255,0.12)] text-[#F2F5F9] hover:bg-[#16191F] font-semibold text-[13px] cursor-pointer transition-colors"
                  >
                    راجع
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 w-full min-h-[48px] px-6 py-3 rounded-full bg-[#2F6BFF] text-white text-[16px] font-bold hover:bg-[#2F6BFF] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] active:scale-[0.98] transition-all shadow-[0_0_16px_rgba(47,107,255,0.3)] focus-visible:ring-2 focus-visible:ring-[#4D9BFF] ${
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isSubmitting
                  ? 'جاري الحفظ في قاعدة البيانات...'
                  : editMode
                  ? 'حفظ التعديلات'
                  : STRINGS_AR.post.submitButton}
              </button>
            )}

            {editMode && onCancelEdit && !confirmingHighRiskPublish && !confirmingBlockedPhotoPublish && (
              confirmingCancel ? (
                <div className="w-full sm:w-auto min-h-[48px] px-4 py-2 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.12)] flex items-center justify-between sm:justify-start gap-2.5">
                  <span className="text-[13px] text-[#FF6B7A] font-semibold whitespace-nowrap">
                    تجاهل التعديلات؟
                  </span>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="min-h-[32px] px-3.5 py-1 rounded-full bg-[#FF6B7A] text-white font-bold text-[12px] hover:bg-[#FF6B7A]/90 transition-colors cursor-pointer"
                  >
                    نعم، تجاهل
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="min-h-[32px] px-2.5 py-1 rounded-full text-[#B4BECB] hover:text-[#F2F5F9] text-[12px] transition-colors cursor-pointer"
                  >
                    متابعة التعديل
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-full border border-[rgba(255,255,255,0.12)] bg-[#16191F] text-[#B4BECB] hover:text-[#F2F5F9] font-medium text-[15px] transition-all cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )
            )}
          </div>
        </form>
      ) : (
        /* Submission Result & Ranked Auto-Matches */
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-6 sm:p-8 space-y-6 text-right shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        >
          {/* Post Header */}
          <div className="p-5 rounded-[20px] bg-[#16191F] border border-[rgba(255,255,255,0.08)] space-y-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="text-[14px] text-[#4D9BFF] font-bold">
              {STRINGS_AR.post.successTitle}
            </div>
            <h2 className="text-[20px] font-bold text-[#F2F5F9]">
              {renderBdi(createdItem.title)}
            </h2>
            <div className="text-[14px] text-[#B4BECB]">
              {renderBdi(createdItem.location)} · {createdItem.date}
            </div>
          </div>

          {/* Ranked Auto-Match Section */}
          {postMatches.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-[20px] bg-[#4D9BFF]/10 border border-[#4D9BFF]/30">
                <Sparkles className="w-5 h-5 text-[#4D9BFF] shrink-0" />
                <div>
                  <h3 className="text-[15px] font-bold text-[#F2F5F9]">
                    {STRINGS_AR.post.matchFoundTitle}
                  </h3>
                  <p className="text-[14px] text-[#B4BECB]">
                    {STRINGS_AR.post.matchFoundDesc(postMatches.length)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {postMatches.map(({ matchedItem, score, matchReasons, isPreliminary }) => (
                  <div
                    key={matchedItem.id}
                    className="p-5 rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#16191F] space-y-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[17px] font-semibold text-[#F2F5F9]">
                        {renderBdi(matchedItem.title)}
                      </span>
                      <StatusBadge
                        type={matchedItem.type}
                        status={matchedItem.status}
                      />
                    </div>

                    {/* Animated Circular Ring Match Score */}
                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-[16px] bg-[#101216] border border-[rgba(255,255,255,0.08)]">
                      <div className="space-y-0.5">
                        <span className="text-[14px] font-bold text-[#F2F5F9] block">
                          {STRINGS_AR.post.matchScoreLabel}
                        </span>
                        <span className="text-[12px] text-[#B4BECB]">
                          {isPreliminary
                            ? 'توافق مبدئي بحسب البيانات المدخلة'
                            : 'توافق ذكي بناءً على الفئة والموقع والوصف'}
                        </span>
                      </div>
                      <MatchScoreRing
                        score={score}
                        size={52}
                        strokeWidth={5}
                        showLabel={true}
                        label={isPreliminary ? 'تطابق مبدئي' : 'درجة التوافق'}
                      />
                    </div>

                    <p className="text-[15px] text-[#B4BECB] leading-[1.6] line-clamp-2">
                      {renderBdi(matchedItem.description)}
                    </p>

                    {/* Match Card Meta Line: الموقع · التاريخ */}
                    <div className="text-[14px] text-[#B4BECB] flex items-center line-clamp-1">
                      <MapPin className="w-4 h-4 text-[#4D9BFF] shrink-0 ml-1.5" />
                      <span>{renderBdi(matchedItem.location)}</span>
                      <span className="mx-2 text-[#B4BECB]/60">·</span>
                      <span>{formatDate(matchedItem.date)}</span>
                    </div>

                    {/* Match Reasons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {isMyItemReport(matchedItem) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.12)] text-[12px] font-medium text-[#B4BECB]">
                          بلاغك
                        </span>
                      )}
                      {isPreliminary && (
                        <span className="px-3 py-1 rounded-full bg-[#101216] border border-[#FFB84D]/40 text-[12px] font-medium text-[#FFB84D]">
                          تطابق مبدئي
                        </span>
                      )}
                      {matchReasons.map((reason, i) => (
                        <MatchReasonChip key={i} reason={reason} />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToDetail(matchedItem)}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-full bg-[#2F6BFF] text-white text-[14px] font-semibold hover:bg-[#2F6BFF] hover:shadow-[0_0_16px_rgba(47,107,255,0.4)] transition-all cursor-pointer shadow-[0_0_10px_rgba(47,107,255,0.3)]"
                    >
                      {STRINGS_AR.post.matchInspectButton}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-[20px] bg-[#16191F] text-center space-y-2 border border-[rgba(255,255,255,0.08)]">
              <h3 className="text-[16px] font-bold text-[#F2F5F9]">
                {STRINGS_AR.post.noMatchesTitle}
              </h3>
              <p className="text-[15px] text-[#B4BECB] leading-[1.6]">
                {STRINGS_AR.post.noMatchesDesc}
              </p>
            </div>
          )}

          {/* After submitting: ONE primary button ("عرض بلاغي") plus ONE quiet text link ("إضافة بلاغ آخر") */}
          <div className="pt-3 space-y-3">
            <button
              type="button"
              onClick={() => onNavigateToDetail(createdItem)}
              className="w-full min-h-[48px] py-3 px-6 rounded-full bg-[#2F6BFF] text-white text-[15px] font-bold hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] active:scale-[0.98] transition-all text-center shadow-[0_0_12px_rgba(47,107,255,0.3)] cursor-pointer"
            >
              {STRINGS_AR.post.viewMyPostButton}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResetForAnother}
                className="text-[14px] text-[#B4BECB] hover:text-[#F2F5F9] underline underline-offset-4 font-medium p-1 transition-colors cursor-pointer"
              >
                {STRINGS_AR.post.postAnotherLink}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
