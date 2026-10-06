import { ItemCategory } from '../types';

export const CATEGORIES: { id: ItemCategory | 'all'; labelAr: string }[] = [
  { id: 'all', labelAr: 'الكل' },
  { id: 'student_id', labelAr: 'بطاقة جامعية' },
  { id: 'electronics', labelAr: 'إلكترونيات وسماعات' },
  { id: 'keys', labelAr: 'مفاتيح' },
  { id: 'chargers', labelAr: 'شواحن وكوابل' },
  { id: 'bags_wallets', labelAr: 'حقائب ومحافظ' },
  { id: 'books_supplies', labelAr: 'أدوات وكتب' },
  { id: 'other', labelAr: 'أخرى' },
];

export const CAMPUS_LOCATIONS: string[] = [
  'كلية علوم الحاسب والمعلومات (مبنى 31)',
  'كلية الهندسة (مبنى 32)',
  'كلية إدارة الأعمال (مبنى 67)',
  'كلية العلوم (مبنى 4)',
  'المكتبة المركزية (مبنى 26)',
  'بهو الجامعة الرئيسي (مبنى 17)',
  'مجمع المطاعم والخدمات الطلابية',
  'الصالة الرياضية والاستاد الرياضي',
  'مواقف كلية علوم الحاسب',
  'سكن الطلاب',
];

export const VALIDATION_LIMITS = {
  description: {
    min: 10,
    max: 200,
    minLetters: 3,
  },
  name: {
    min: 3,
    max: 40,
  },
  phone: {
    exactLength: 10,
    prefix: '05',
  },
  photo: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
  },
  date: {
    maxPastDays: 90,
  },
  verificationQuestion: {
    min: 5,
  },
  claimAnswer: {
    min: 3,
  },
} as const;

export const MATCH_WEIGHTS = {
  sameCategory: 40,
  sameLocation: 25,
  nearbyBuilding: 15,
  dateWithin7Days: 20,
  keywordOverlap: 15,
  minMatchScore: 55,
} as const;

export const FEED_CONFIG = {
  initialPageSize: 12,
  pageSizeIncrement: 12,
  searchDebounceMs: 250,
} as const;

export const STORAGE_KEYS = {
  items: 'taman:items',
  myItems: 'taman:my_item_ids',
  legacyItems: 'laqetha:items',
  legacyMyItems: 'laqetha:my_item_ids',
} as const;
