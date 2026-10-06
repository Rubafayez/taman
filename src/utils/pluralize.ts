import { toArabicDigits } from '../config/strings.ar';

/**
 * Arabic number agreement via ONE shared pluralize() helper used for every counted label in the app:
 * ١ → "غرض رجع لصاحبه" · ٢ → "غرضان" · ٣–١٠ → "أغراض" · ١١+ → "غرضاً"
 */
export function pluralize(
  count: number,
  options: {
    singular: string;
    dual: string;
    plural: string; // 3 - 10
    accusative: string; // 11+
    zero?: string;
  }
): string {
  if (count === 0 && options.zero !== undefined) {
    return options.zero;
  }
  if (count === 1) {
    return options.singular;
  }
  if (count === 2) {
    return options.dual;
  }
  if (count >= 3 && count <= 10) {
    return `${toArabicDigits(count)} ${options.plural}`;
  }
  return `${toArabicDigits(count)} ${options.accusative}`;
}

/**
 * Specialized helper for returned items agreement:
 * ١ → "غرض رجع لصاحبه" · ٢ → "غرضان" · ٣–١٠ → "أغراض" · ١١+ → "غرضاً"
 */
export function pluralizeReturnedItems(count: number): string {
  if (count === 0) return 'أغراض رجعت لأصحابها';
  if (count === 1) return 'غرض رجع لصاحبه';
  if (count === 2) return 'غرضان';
  if (count >= 3 && count <= 10) return `${toArabicDigits(count)} أغراض`;
  return `${toArabicDigits(count)} غرضاً`;
}

/**
 * Reports count agreement
 */
export function pluralizeReports(count: number): string {
  if (count === 0) return 'لا توجد بلاغات';
  if (count === 1) return 'بلاغ واحد';
  if (count === 2) return 'بلاغان';
  if (count >= 3 && count <= 10) return `${toArabicDigits(count)} بلاغات`;
  return `${toArabicDigits(count)} بلاغاً`;
}

/**
 * Locations count agreement
 */
export function pluralizeLocations(count: number): string {
  if (count === 0) return 'مواقع مشمولة';
  if (count === 1) return 'موقع واحد';
  if (count === 2) return 'موقعان';
  if (count >= 3 && count <= 10) return `${toArabicDigits(count)} مواقع`;
  return `${toArabicDigits(count)} موقعاً`;
}
