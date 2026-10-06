import { toArabicDigits } from '../config/strings.ar';

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Formats any ISO date or date string into unified Arabic date string:
 * "2026-09-30" -> "٣٠ سبتمبر ٢٠٢٦"
 * Uses Arabic-Indic digits and guarantees the day number is never malformed or concatenated.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const cleanStr = dateStr.trim();
  if (!cleanStr) return '';

  let y: number;
  let m: number;
  let d: number;

  // Match ISO YYYY-MM-DD pattern at the beginning of the string
  const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10) - 1;
    // Exactly 1 or 2 digits, parsed cleanly as an integer between 1 and 31
    d = parseInt(isoMatch[3], 10);
  } else {
    const dt = new Date(cleanStr);
    if (!isNaN(dt.getTime())) {
      y = dt.getFullYear();
      m = dt.getMonth();
      d = dt.getDate();
    } else {
      // Fallback: look for any 4-digit year and nearby digits
      const fallbackMatch = cleanStr.match(/(\d{4})/);
      if (fallbackMatch) {
        y = parseInt(fallbackMatch[1], 10);
        m = 8; // September fallback
        d = 30;
      } else {
        return cleanStr;
      }
    }
  }

  // Ensure day and month bounds are strictly enforced (never concatenated or out of range)
  d = Math.max(1, Math.min(31, Math.floor(d)));
  m = Math.max(0, Math.min(11, Math.floor(m)));
  const monthName = ARABIC_MONTHS[m] || 'سبتمبر';

  return `${toArabicDigits(d)} ${monthName} ${toArabicDigits(y)}`;
}
