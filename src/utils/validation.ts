import { VALIDATION_LIMITS, CAMPUS_LOCATIONS } from '../config/constants';
import { STRINGS_AR, toArabicDigits } from '../config/strings.ar';
import { ItemCategory, ItemType } from '../types';

/**
 * Converts Arabic-Indic numerals (٠-٩) to Latin (0-9).
 */
export function normalizeArabicIndicDigits(str: string): string {
  if (!str) return '';
  const arabicIndicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return str.replace(/[٠-٩]/g, (ch) => arabicIndicMap[ch] || ch);
}

/**
 * Normalizes phone number on paste/input:
 * - converts Arabic-Indic digits to Latin
 * - strips spaces, dashes, parentheses
 * - strips leading +966 or 00966 and replaces with 0
 * - filters non-digits
 * - truncates to 10 characters
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  let cleaned = normalizeArabicIndicDigits(raw).trim();
  // Strip common Saudi prefixes
  if (cleaned.startsWith('+966')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('00966')) {
    cleaned = '0' + cleaned.slice(5);
  } else if (cleaned.startsWith('966')) {
    cleaned = '0' + cleaned.slice(3);
  }
  // Remove any non-digits
  cleaned = cleaned.replace(/\D/g, '');
  return cleaned.slice(0, VALIDATION_LIMITS.phone.exactLength);
}

/**
 * Counts unicode letters in a string (Arabic, Latin, etc.)
 */
export function countLetters(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\p{L}/gu);
  return matches ? matches.length : 0;
}

/* ================= Individual Field Validators ================= */

export function validateType(value?: string | null): string | null {
  if (!value || (value !== 'lost' && value !== 'found')) {
    return STRINGS_AR.validation.typeRequired;
  }
  return null;
}

export function validateCategory(value?: string | null): string | null {
  if (!value || value.trim() === '' || value === 'all') {
    return STRINGS_AR.validation.categoryRequired;
  }
  return null;
}

export function validateDescription(value?: string | null): string | null {
  const text = (value || '').trim();
  if (text.length < VALIDATION_LIMITS.description.min) {
    return STRINGS_AR.validation.descriptionTooShort;
  }
  if (text.length > VALIDATION_LIMITS.description.max) {
    return STRINGS_AR.validation.descriptionTooLong;
  }
  if (countLetters(text) < VALIDATION_LIMITS.description.minLetters) {
    return STRINGS_AR.validation.descriptionLettersRequired;
  }
  return null;
}

export function validateLocation(value?: string | null): string | null {
  const loc = (value || '').trim();
  if (!loc || !CAMPUS_LOCATIONS.includes(loc)) {
    return STRINGS_AR.validation.locationRequired;
  }
  return null;
}

export function validateDate(value?: string | null): string | null {
  const dateStr = (value || '').trim();
  if (!dateStr) {
    return STRINGS_AR.validation.dateRequired;
  }
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    return STRINGS_AR.validation.dateRequired;
  }

  // Normalize date comparison to local day midnight
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (dateObj > todayEnd) {
    return STRINGS_AR.validation.dateFuture;
  }

  const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - VALIDATION_LIMITS.date.maxPastDays, 0, 0, 0, 0);
  if (dateObj < ninetyDaysAgo) {
    return STRINGS_AR.validation.dateTooOld;
  }

  return null;
}

export function validatePhotoFile(file?: File | null): string | null {
  if (!file) return null; // Optional
  const allowed = (VALIDATION_LIMITS.photo.allowedMimeTypes as readonly string[]);
  const isImage = file.type ? allowed.includes(file.type.toLowerCase()) || file.type.startsWith('image/') : false;
  if (!isImage) {
    return STRINGS_AR.validation.photoNotImage;
  }
  if (file.size > VALIDATION_LIMITS.photo.maxSizeBytes) {
    return STRINGS_AR.validation.photoTooLarge;
  }
  return null;
}

export function validateName(value?: string | null): string | null {
  const name = (value || '').trim();
  if (!name) {
    return STRINGS_AR.validation.nameRequired;
  }
  if (name.length < VALIDATION_LIMITS.name.min) {
    return STRINGS_AR.validation.nameTooShort;
  }
  if (name.length > VALIDATION_LIMITS.name.max) {
    return STRINGS_AR.validation.nameTooLong;
  }
  // Only letters and spaces (supports Arabic unicode and Latin)
  const lettersAndSpacesOnly = /^[\p{L}\s]+$/u;
  if (!lettersAndSpacesOnly.test(name)) {
    return STRINGS_AR.validation.nameInvalid;
  }
  return null;
}

export function validatePhone(value?: string | null): string | null {
  const phone = (value || '').trim();
  if (!phone) {
    return STRINGS_AR.validation.phoneRequired;
  }
  if (!phone.startsWith(VALIDATION_LIMITS.phone.prefix)) {
    return STRINGS_AR.validation.phoneMustStart05;
  }
  if (phone.length !== VALIDATION_LIMITS.phone.exactLength || /\D/.test(phone)) {
    return STRINGS_AR.validation.phoneLength;
  }
  return null;
}

export function validateVerificationQuestion(value?: string | null): string | null {
  const q = (value || '').trim();
  // Optional, but if filled, must be at least 5 chars
  if (q.length > 0 && q.length < VALIDATION_LIMITS.verificationQuestion.min) {
    return STRINGS_AR.validation.verificationQuestionTooShort;
  }
  return null;
}

export function validateClaimAnswer(value?: string | null, isRequired = false): string | null {
  if (!isRequired) return null;
  const ans = (value || '').trim();
  if (ans.length === 0) {
    return STRINGS_AR.validation.claimAnswerRequired;
  }
  if (ans.length < VALIDATION_LIMITS.claimAnswer.min) {
    return STRINGS_AR.validation.claimAnswerTooShort;
  }
  return null;
}

/* ================= Form-Level Validators ================= */

export interface ItemFormData {
  type: ItemType | '';
  category: ItemCategory | '';
  description: string;
  location: string;
  date: string;
  contactName: string;
  contactPhone: string;
  verificationQuestion?: string;
  photoFile?: File | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstErrorField: string | null;
  errorCount: number;
}

export const ITEM_FIELD_ORDER = [
  'type',
  'category',
  'description',
  'location',
  'date',
  'photo',
  'verificationQuestion',
  'contactName',
  'contactPhone',
] as const;

export function validateItemForm(data: ItemFormData): ValidationResult {
  const errors: Record<string, string> = {};

  const typeErr = validateType(data.type);
  if (typeErr) errors.type = typeErr;

  const catErr = validateCategory(data.category);
  if (catErr) errors.category = catErr;

  const descErr = validateDescription(data.description);
  if (descErr) errors.description = descErr;

  const locErr = validateLocation(data.location);
  if (locErr) errors.location = locErr;

  const dateErr = validateDate(data.date);
  if (dateErr) errors.date = dateErr;

  const photoErr = validatePhotoFile(data.photoFile);
  if (photoErr) errors.photo = photoErr;

  if (data.type === 'found' && data.verificationQuestion) {
    const qErr = validateVerificationQuestion(data.verificationQuestion);
    if (qErr) errors.verificationQuestion = qErr;
  }

  const nameErr = validateName(data.contactName);
  if (nameErr) errors.contactName = nameErr;

  const phoneErr = validatePhone(data.contactPhone);
  if (phoneErr) errors.contactPhone = phoneErr;

  let firstErrorField: string | null = null;
  for (const field of ITEM_FIELD_ORDER) {
    if (errors[field]) {
      firstErrorField = field;
      break;
    }
  }

  const errorCount = Object.keys(errors).length;

  return {
    isValid: errorCount === 0,
    errors,
    firstErrorField,
    errorCount,
  };
}

export const CLAIM_FIELD_ORDER = [
  'claimantAnswer',
  'claimantName',
  'claimantPhone',
] as const;

export function validateClaimForm(
  claimantName: string,
  claimantPhone: string,
  answerProvided?: string,
  requiresAnswer = false
): ValidationResult {
  const errors: Record<string, string> = {};

  if (requiresAnswer) {
    const ansErr = validateClaimAnswer(answerProvided, true);
    if (ansErr) errors.claimantAnswer = ansErr;
  }

  const nameErr = validateName(claimantName);
  if (nameErr) errors.claimantName = nameErr;

  const phoneErr = validatePhone(claimantPhone);
  if (phoneErr) errors.claimantPhone = phoneErr;

  let firstErrorField: string | null = null;
  for (const field of CLAIM_FIELD_ORDER) {
    if (errors[field]) {
      firstErrorField = field;
      break;
    }
  }

  const errorCount = Object.keys(errors).length;

  return {
    isValid: errorCount === 0,
    errors,
    firstErrorField,
    errorCount,
  };
}

export { toArabicDigits };
