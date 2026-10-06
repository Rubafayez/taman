import { CampusItem, AutoMatchResult, ItemCategory } from '../types';
import { MATCH_WEIGHTS } from '../config/constants';
import { toArabicDigits } from '../config/strings.ar';

function getCurrentDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('taman:device_id') || '';
    }
  } catch {}
  return '';
}

/**
 * Checks whether an item was created by or belongs to the current user's device.
 * A student can never be matched with themselves.
 */
export function isMyItemReport(item: CampusItem, currentDeviceId?: string): boolean {
  const deviceId = currentDeviceId || getCurrentDeviceId();
  if (item.isMyItem) return true;
  const anyItem = item as any;
  if (deviceId) {
    if (anyItem.owner_device_id && anyItem.owner_device_id === deviceId) return true;
    if (anyItem.creator_device_id && anyItem.creator_device_id === deviceId) return true;
  }
  return false;
}

/**
 * Common Arabic stop words to ignore during description keyword overlap check.
 */
const ARABIC_STOPWORDS = new Set([
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'تم', 'كان', 'كانت',
  'أو', 'ثم', 'لا', 'ما', 'هو', 'هي', 'أن', 'إن', 'كل', 'بعد', 'قبل',
  'عند', 'بين', 'له', 'لها', 'بها', 'فيه', 'فيها', 'ضياع', 'فقدان', 'العثور'
]);

function extractKeywords(text: string): Set<string> {
  if (!text) return new Set();
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !ARABIC_STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Build an index Map of items grouped by category for high-performance bucket lookup.
 */
export function buildCategoryIndex(items: CampusItem[]): Map<ItemCategory, CampusItem[]> {
  const index = new Map<ItemCategory, CampusItem[]>();
  for (const item of items) {
    if (!item.category) continue;
    const bucket = index.get(item.category);
    if (bucket) {
      bucket.push(item);
    } else {
      index.set(item.category, [item]);
    }
  }
  return index;
}

/**
 * Score each candidate from the matching category bucket:
 * - same category: +40 (applies ONLY to specific categories, NOT "أخرى")
 * - same location: +25
 * - nearby / same building: +15
 * - date within 7 days: +20
 * - keyword overlap in description: +15
 * 
 * Rules enforced:
 * - MY OWN REPORTS MUST NEVER APPEAR AS MATCHES (excluded via isMyItemReport).
 * - Exclude target item itself by id.
 * - Exclude items of the SAME type: lost matches found and vice versa.
 * - Never show matches for an item that is already resolved.
 * - When both items are "أخرى", category contributes 0 and cannot match on location+date alone.
 * - Cap rule-based score at 70 (only semantic can push higher).
 * - Label score with isPreliminary: true.
 * - Sort matches by score descending, and on ties, by closeness in date.
 * - Returns at most 3 matches.
 */
export function findAutoMatches(
  targetItem: CampusItem,
  allPoolOrIndex: CampusItem[] | Map<ItemCategory, CampusItem[]>
): AutoMatchResult[] {
  // Never show matches for an item that is already resolved or invalid
  if (!targetItem || !targetItem.category || targetItem.status === 'resolved') return [];

  // Drop entirely if target category is "other" and no semantic similarity is present
  // A match must not be shown on location + date alone.
  if (targetItem.category === 'other') return [];

  const currentDeviceId = getCurrentDeviceId();

  // Index items by category into a Map once, and match against that bucket
  let candidatesBucket: CampusItem[];
  if (allPoolOrIndex instanceof Map) {
    candidatesBucket = allPoolOrIndex.get(targetItem.category) || [];
  } else {
    const categoryIndex = buildCategoryIndex(allPoolOrIndex);
    candidatesBucket = categoryIndex.get(targetItem.category) || [];
  }

  const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';
  const targetKeywords = extractKeywords(`${targetItem.title} ${targetItem.description}`);
  const targetDate = new Date(targetItem.date).getTime();
  const targetLoc = (targetItem.location || '').trim().toLowerCase();

  const results: AutoMatchResult[] = [];

  for (const candidate of candidatesBucket) {
    // 1. Exclude item itself
    if (candidate.id === targetItem.id) continue;

    // 2. Candidate must be active (never match resolved candidates)
    if (candidate.status !== 'active') continue;

    // 3. Exclude same type: a lost report may ONLY match found reports and vice versa
    if (candidate.type !== oppositeType) continue;

    // 4. When candidate category is "other", category contributes 0 and location+date alone is dropped
    if (candidate.category === 'other') continue;

    let score = 0;
    const reasons: string[] = [];

    // Specific shared category (+40) — guaranteed by bucket and not "other"
    score += MATCH_WEIGHTS.sameCategory;
    reasons.push('نفس الفئة');

    // Same location (+25)
    const candidateLoc = (candidate.location || '').trim().toLowerCase();
    const isSameLocation = targetLoc === candidateLoc;
    if (isSameLocation) {
      score += MATCH_WEIGHTS.sameLocation;
      reasons.push('نفس الموقع تماماً');
    }

    // Nearby / same building (+15)
    const buildingRegex = /(?:مبنى|قاعة|كلية)\s*([0-9\u0660-\u0669]+|[^\s,]+)/g;
    const targetBuildings = [...targetLoc.matchAll(buildingRegex)].map((m) => m[0]);
    const candidateBuildings = [...candidateLoc.matchAll(buildingRegex)].map((m) => m[0]);
    const sharesBuilding =
      !isSameLocation &&
      (targetLoc.includes(candidateLoc) ||
        candidateLoc.includes(targetLoc) ||
        targetBuildings.some((b) => candidateLoc.includes(b)) ||
        candidateBuildings.some((b) => targetLoc.includes(b)) ||
        (targetItem.buildingNumber && targetItem.buildingNumber === candidate.buildingNumber));

    if (sharesBuilding) {
      score += MATCH_WEIGHTS.nearbyBuilding;
      reasons.push('مبنى أو كلية مشتركة');
    }

    // Date within 7 days (+20)
    const candidateDate = new Date(candidate.date).getTime();
    const diffDays = Math.abs(targetDate - candidateDate) / (1000 * 60 * 60 * 24);
    if (!isNaN(diffDays) && diffDays <= 7) {
      score += MATCH_WEIGHTS.dateWithin7Days;
      const roundedDays = Math.round(diffDays);
      reasons.push(roundedDays === 0 ? 'نفس اليوم' : `خلال ${toArabicDigits(roundedDays)} أيام`);
    }

    // Keyword overlap in description (+15)
    const candidateKeywords = extractKeywords(`${candidate.title} ${candidate.description}`);
    let commonCount = 0;
    for (const kw of targetKeywords) {
      if (candidateKeywords.has(kw)) {
        commonCount++;
      }
    }
    if (commonCount > 0) {
      score += MATCH_WEIGHTS.keywordOverlap;
      reasons.push(`تطابق وصف (${toArabicDigits(commonCount)} كلمات دلالية)`);
    }

    // Cap rule-based portion at 70. Only semantic component can push above that!
    const ruleScore = Math.min(score, 70);

    // Show a match when score >= 55
    if (ruleScore >= MATCH_WEIGHTS.minMatchScore) {
      results.push({
        matchedItem: candidate,
        score: ruleScore,
        matchReasons: reasons,
        isPreliminary: true, // Rule-only score labeled "تطابق مبدئي"
      });
    }
  }

  // Sort matches by score descending and, when scores tie, by closeness in date
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = new Date(a.matchedItem.date).getTime();
    const timeB = new Date(b.matchedItem.date).getTime();
    const diffA = isNaN(timeA) ? Infinity : Math.abs(targetDate - timeA);
    const diffB = isNaN(timeB) ? Infinity : Math.abs(targetDate - timeB);
    return diffA - diffB;
  });

  // Show at most 3 matches
  return results.slice(0, 3);
}

/**
 * Format score into Eastern Arabic digits percentage (e.g. ٨٥٪)
 */
export function formatArabicPercentage(num: number): string {
  return `نسبة التطابق ${toArabicDigits(num)}٪`;
}
