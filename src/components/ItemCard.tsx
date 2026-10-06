import React from 'react';
import { CampusItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { toArabicDigits } from '../config/strings.ar';
import { renderBdi } from '../utils/text';
import {
  CreditCard,
  Headphones,
  Key,
  Zap,
  Briefcase,
  BookOpen,
  Package,
} from 'lucide-react';

interface ItemCardProps {
  item: CampusItem;
  onSelect: (item: CampusItem) => void;
}

interface CategoryConfig {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  nameAr: string;
  gradientTo: string;
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
  student_id: {
    icon: CreditCard,
    nameAr: 'بطاقة جامعية',
    gradientTo: '#1D2636',
  },
  electronics: {
    icon: Headphones,
    nameAr: 'إلكترونيات وسماعات',
    gradientTo: '#1E2838',
  },
  keys: {
    icon: Key,
    nameAr: 'مفاتيح',
    gradientTo: '#242426',
  },
  chargers: {
    icon: Zap,
    nameAr: 'شواحن وكوابل',
    gradientTo: '#1F2633',
  },
  bags_wallets: {
    icon: Briefcase,
    nameAr: 'حقائب ومحافظ',
    gradientTo: '#222129',
  },
  books_supplies: {
    icon: BookOpen,
    nameAr: 'أدوات وكتب',
    gradientTo: '#1B242C',
  },
  other: {
    icon: Package,
    nameAr: 'أخرى',
    gradientTo: '#1E2430',
  },
};

function formatArabicRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();

  let targetDate: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    targetDate = new Date(y, m - 1, d);
  } else {
    targetDate = new Date(dateStr);
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const diffDays = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'اليوم';
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'قبل يومين';
  if (diffDays >= 3 && diffDays <= 10) return `قبل ${toArabicDigits(diffDays)} أيام`;
  if (diffDays > 10 && diffDays <= 13) return `قبل ${toArabicDigits(diffDays)} يوماً`;
  if (diffDays >= 14 && diffDays <= 20) return 'قبل أسبوعين';
  if (diffDays >= 21 && diffDays <= 27) return 'قبل ٣ أسابيع';
  if (diffDays >= 28 && diffDays <= 59) return 'قبل شهر';
  if (diffDays >= 60 && diffDays <= 89) return 'قبل شهرين';
  return `قبل ${toArabicDigits(Math.floor(diffDays / 30))} أشهر`;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onSelect }) => {
  const isResolved = item.status === 'resolved';
  const catConfig = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
  const CategoryIcon = catConfig.icon;
  const relativeTime = React.useMemo(() => formatArabicRelativeTime(item.date), [item.date]);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      aria-label={`عرض تفاصيل: ${item.title}`}
      className={`group w-full text-right cursor-pointer flex flex-col bg-[#101216] border border-[rgba(255,255,255,0.08)] rounded-[20px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4D9BFF] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#4D9BFF] focus-visible:outline-none select-none ${
        isResolved ? 'opacity-55' : ''
      }`}
    >
      {/* 1. Media Area: Strict 4:3 aspect ratio across all cards */}
      <div className="relative w-full aspect-[4/3] overflow-hidden shrink-0 bg-[#16191F]">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isResolved ? 'grayscale' : ''
            }`}
          />
        ) : (
          /* NO-PHOTO CARDS: Real placeholder with diagonal gradient, faint dot texture, centered 56px icon in --blue-400 at 40% opacity, and category name at 13px --text-300 */
          <div
            className="w-full h-full relative flex flex-col items-center justify-center p-4"
            style={{
              background: `linear-gradient(135deg, #16191F 0%, ${catConfig.gradientTo} 100%)`,
            }}
          >
            {/* Faint dot texture overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '12px 12px',
              }}
              aria-hidden="true"
            />

            {/* Centered category icon at 56px in --blue-400 at 40% opacity */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-2">
              <CategoryIcon
                size={56}
                className="text-[#4D9BFF] opacity-40 shrink-0 stroke-[1.75]"
              />
              {/* Category name under it at 13px --text-300 */}
              <span className="text-[13px] font-medium text-[#B4BECB] tracking-wide select-none">
                {catConfig.nameAr}
              </span>
            </div>
          </div>
        )}

        {/* Floating status badge & ownership indicator over top corner */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          <StatusBadge
            type={item.type}
            status={item.status}
          />
          {item.isMyItem && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#101216]/90 border border-[#4D9BFF]/40 text-[#4D9BFF] text-[11px] font-bold shadow-sm backdrop-blur-sm">
              بلاغي
            </span>
          )}
          {item.aiGenerated && (
            <span
              title="مُنشأ بمساعدة الذكاء الاصطناعي"
              className="px-2 py-0.5 rounded-full bg-[#101216]/90 border border-[#4D9BFF]/40 text-[#4D9BFF] text-[11px] font-bold shadow-sm backdrop-blur-sm flex items-center gap-1"
            >
              <span>✨</span>
              <span className="hidden sm:inline">اقتراح ذكي</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Content, in order: title · 2-line description · one meta line */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 text-right">
        <div className="space-y-1.5">
          {/* 2. Title: 2-line clamp ending at a word boundary */}
          <h3 className="text-[clamp(16px,1.2vw,19px)] font-semibold text-[#F2F5F9] group-hover:text-[#4D9BFF] transition-colors line-clamp-2 leading-[1.35] [word-break:normal] [overflow-wrap:break-word]">
            {renderBdi(item.title)}
          </h3>

          {/* 3. Description: 2-line clamp */}
          <p className="text-[14px] text-[#B4BECB] leading-[1.6] line-clamp-2 [word-break:normal] [overflow-wrap:break-word]">
            {renderBdi(item.description)}
          </p>
        </div>

        {/* 4. One meta line: 📍 الموقع · قبل يومين */}
        <div className="text-[14px] text-[#B4BECB] truncate min-w-0 pt-1 border-t border-[rgba(255,255,255,0.06)] flex items-center">
          <span>📍 {renderBdi(item.location)}</span>
          <span className="mx-1.5 text-[#B4BECB]/60">·</span>
          <span>{relativeTime}</span>
        </div>
      </div>
    </article>
  );
};
