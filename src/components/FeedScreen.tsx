import React, { useState, useMemo, useEffect } from 'react';
import { CampusItem, ItemCategory } from '../types';
import { CATEGORIES, FEED_CONFIG } from '../config/constants';
import { STRINGS_AR, toArabicDigits } from '../config/strings.ar';
import { ItemCard } from './ItemCard';
import { CardSkeleton } from './CardSkeleton';
import { StatStrip } from './StatStrip';
import { ShieldIcon } from './ShieldIcon';
import { HeroConstellation } from './HeroConstellation';
import { Search, Plus, RotateCcw, ChevronDown, Camera, Sparkles, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { motion } from 'motion/react';
import { pluralize } from '../utils/pluralize';
import { AiSparkleChip } from './AiSparkleChip';

interface FeedScreenProps {
  items: CampusItem[];
  isLoading?: boolean;
  onSelectItem: (item: CampusItem) => void;
  onNavigateToPost: () => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  items,
  isLoading = false,
  onSelectItem,
  onNavigateToPost,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState<number>(FEED_CONFIG.initialPageSize);
  const [isSearching, setIsSearching] = useState(false);

  // First Visit dismissible card state (saved in localStorage "taman:seen_features")
  const [hasSeenFeatures, setHasSeenFeatures] = useState<boolean>(() => {
    try {
      return localStorage.getItem('taman:seen_features') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissFeatures = () => {
    try {
      localStorage.setItem('taman:seen_features', 'true');
    } catch (err) {
      console.warn('Storage error on dismiss features:', err);
    }
    setHasSeenFeatures(true);
  };

  // Debounce search input by 250ms
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setVisibleCount(FEED_CONFIG.initialPageSize);
      setIsSearching(false);
    }, FEED_CONFIG.searchDebounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  const handleTypeFilterChange = (newType: 'all' | 'lost' | 'found') => {
    setIsSearching(true);
    setTypeFilter(newType);
    setVisibleCount(FEED_CONFIG.initialPageSize);
    setTimeout(() => setIsSearching(false), 120);
  };

  const handleCategoryFilterChange = (newCat: ItemCategory | 'all') => {
    setIsSearching(true);
    setCategoryFilter(newCat);
    setVisibleCount(FEED_CONFIG.initialPageSize);
    setTimeout(() => setIsSearching(false), 120);
  };

  // Memoized filtering
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      // Filter 1: Lost / Found
      if (typeFilter === 'lost' && item.type !== 'lost') return false;
      if (typeFilter === 'found' && item.type !== 'found') return false;

      // Filter 2: Category
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Search Box (debounced)
      if (debouncedQuery) {
        const query = debouncedQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(query);
        const inDesc = item.description.toLowerCase().includes(query);
        const inLoc = item.location.toLowerCase().includes(query);
        if (!inTitle && !inDesc && !inLoc) return false;
      }

      return true;
    });

    // List active items first, resolved items after
    return list.sort((a, b) => {
      if (a.status === 'active' && b.status === 'resolved') return -1;
      if (a.status === 'resolved' && b.status === 'active') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, typeFilter, categoryFilter, debouncedQuery]);

  const handleResetFilters = () => {
    setIsSearching(true);
    setSearchInput('');
    setDebouncedQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setVisibleCount(FEED_CONFIG.initialPageSize);
    setTimeout(() => setIsSearching(false), 120);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + FEED_CONFIG.pageSizeIncrement);
  };

  const displayedItems = filteredItems.slice(0, visibleCount);
  const hasMore = filteredItems.length > visibleCount;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 min-w-0 w-full">
      {/* 1. FIRST VISIT: one dismissible card, shown once */}
      {!hasSeenFeatures && (
        <div
          role="region"
          aria-label="جديد في تأمن"
          className="rounded-[20px] bg-[#101216] border border-[rgba(255,255,255,0.08)] p-3.5 sm:p-4 text-[13px] relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] min-w-0 w-full"
        >
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 font-bold text-[#F2F5F9]">
              <span className="text-[14px] sm:text-[15px]">جديد في تأمن</span>
              <AiSparkleChip />
            </div>
            <button
              type="button"
              onClick={handleDismissFeatures}
              aria-label="إغلاق التنبيه"
              className="min-h-[44px] min-w-[44px] -m-2 flex items-center justify-center text-[#B4BECB] hover:text-[#F2F5F9] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2.5 text-[#B4BECB] text-[13px] leading-snug">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-[#F2F5F9] inline-flex items-center gap-1 shrink-0">
                <span>صوّر وانشر</span>
                <AiSparkleChip />
              </span>
              <span className="text-[#B4BECB]">
                — ارفع صورة الغرض ونكتب لك الوصف والفئة تلقائياً
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-[#F2F5F9] inline-flex items-center gap-1 shrink-0">
                <span>نطابق بالمعنى</span>
                <AiSparkleChip />
              </span>
              <span className="text-[#B4BECB]">
                — نربط "سماعات بيضاء" بـ "AirPods" حتى لو اختلفت الكلمات
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-semibold text-[#F2F5F9] shrink-0">
                تسليم موثّق
              </span>
              <span className="text-[#B4BECB]">
                — رمز تسليم وتأكيد من الطرفين قبل إغلاق البلاغ
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. HERO: "الأغراض تلقى طريقها" (Campus Constellation)
          - Constellation Layer: Inline SVG layer filling the hero, 18 dots, connecting lines every 2.4s, pulsing endpoints
          - Radar from the Shield: Concentric rings scale 1 -> 1.9 from center, shield watermark floats slowly at bottom-start
          - Light Sweep: Soft diagonal band traversing hero every 9s (2.5s pass)
          - The Text: Headline with "وتعود إليك" in blue gradient shimmer (#4D9BFF → #A9CCFF)
      */}
      <section
        className="relative overflow-hidden text-[#F2F5F9] py-7 sm:py-10 md:py-14 px-4 sm:px-8 md:px-12 rounded-[24px] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] w-full"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(77, 155, 255, 0.12) 0%, transparent 65%), linear-gradient(135deg, #0E1424 0%, #0A0B0D 100%)',
        }}
      >
        {/* 1. Constellation Layer (inline SVG filling the hero, behind text) */}
        <HeroConstellation />

        {/* 2. Radar from the Shield: bottom-start, ~45% height, 6% opacity, floating + 3 concentric expanding rings */}
        <div
          className="absolute start-6 bottom-6 w-[120px] sm:w-[140px] h-[120px] sm:h-[140px] pointer-events-none select-none z-[1] flex items-center justify-center"
          aria-hidden="true"
        >
          {/* Three concentric rings expanding outward from center, 1.2s offset, 5s loop */}
          <div className="hero-radar-ring hero-radar-1" />
          <div className="hero-radar-ring hero-radar-2" />
          <div className="hero-radar-ring hero-radar-3" />

          {/* Floating shield watermark (~6% opacity, translateY ±6px over 6s) */}
          <div className="w-full h-full opacity-[0.06] flex items-center justify-center hero-shield-float">
            <ShieldIcon size={130} className="w-full h-full text-white pointer-events-none" />
          </div>
        </div>

        {/* 3. Light Sweep: soft diagonal light band traveling across every 9s (2.5s pass) */}
        <div className="hero-light-sweep-bar" aria-hidden="true" />

        {/* 4. Content: headline · one sub-line · one primary pill CTA */}
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-4 px-2">
          {/* Headline: --text-100 with last two words "وتعود إليك" in blue gradient shimmer */}
          <h1 className="text-[clamp(24px,3.4vw,40px)] font-extrabold text-[#F2F5F9] leading-[1.25] tracking-tight">
            <span>مفقوداتك الجامعية في أمان </span>
            <span className="hero-gradient-text">وتعود إليك</span>
          </h1>

          {/* Sub-line: --text-300, clamp(14px, 1.3vw, 18px) */}
          <p className="text-[clamp(14px,1.3vw,18px)] text-[#B4BECB] max-w-2xl mx-auto leading-[1.6]">
            {STRINGS_AR.brand.subtitle}
          </p>

          {/* Primary Pill CTA */}
          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={onNavigateToPost}
              className="min-h-[48px] px-8 py-3 rounded-full bg-[#2F6BFF] text-white text-[15px] font-semibold hover:bg-[#2F6BFF] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_16px_rgba(47,107,255,0.3)]"
            >
              <Plus className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{STRINGS_AR.feed.addNewCTA}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. STAT STRIP:
          One wide panel (--bg-900, --line, radius 20px) split into 4 cells by thin vertical rules
      */}
      <StatStrip items={items} isLoading={isLoading} />

      {/* 4. HOME: "كيف يعمل تأمن؟" — three steps, one row (stacked under 640px) */}
      <section className="space-y-3 min-w-0 w-full" aria-labelledby="how-it-works-title">
        <h2 id="how-it-works-title" className="text-[15px] sm:text-[16px] font-bold text-[#F2F5F9]">
          كيف يعمل تأمن؟
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0 w-full">
          {/* Card 1 */}
          <div className="p-3.5 sm:p-4 rounded-[18px] bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF] shrink-0 mt-0.5">
              <Camera className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[#F2F5F9] flex items-center gap-1.5 flex-wrap">
                <span>صوّر وانشر</span>
                <AiSparkleChip />
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-[#B4BECB] leading-[1.5]">
                ارفع صورة الغرض ونكتب لك الوصف والفئة تلقائياً
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-3.5 sm:p-4 rounded-[18px] bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF] shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[#F2F5F9] flex items-center gap-1.5 flex-wrap">
                <span>نطابق بالمعنى</span>
                <AiSparkleChip />
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-[#B4BECB] leading-[1.5]">
                نربط "سماعات بيضاء" بـ "AirPods" حتى لو اختلفت الكلمات
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-3.5 sm:p-4 rounded-[18px] bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#FFB84D] shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[#F2F5F9] flex items-center gap-1.5 flex-wrap">
                <span>حارس الخصوصية</span>
                <AiSparkleChip />
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-[#B4BECB] leading-[1.5]">
                نراجع وصفك ونمنع نشر ما يكشف هويتك أو يسهّل انتحال غرضك
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-3.5 sm:p-4 rounded-[18px] bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#3DDC97] shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="text-[14px] font-bold text-[#F2F5F9]">
                <span>تسليم موثّق</span>
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-[#B4BECB] leading-[1.5]">
                رمز تسليم وتأكيد من الطرفين قبل إغلاق البلاغ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SEARCH & FILTERS:
          - No bordered box wrapping both search and filters (no box-inside-a-box)
          - Search keeps its own --bg-800 pill
          - Filters are plain pills on the page
      */}
      <div className="space-y-4 min-w-0 w-full">
        {/* Search Box: Standalone --bg-800 pill, 16px font-size, 48px min-height */}
        <div className="relative min-w-0 w-full">
          <label htmlFor="feed-search" className="sr-only">
            {STRINGS_AR.feed.searchAria}
          </label>
          <Search
            className="w-5 h-5 text-[#4D9BFF] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="feed-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={STRINGS_AR.feed.searchPlaceholder}
            className="w-full min-h-[48px] pr-12 pl-10 py-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#16191F] text-[16px] text-[#F2F5F9] placeholder:text-[#B4BECB]/50 focus:outline-none focus:border-[#4D9BFF] focus:ring-2 focus:ring-[#4D9BFF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setDebouncedQuery('');
              }}
              aria-label={STRINGS_AR.feed.clearSearchAria}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-[14px] text-[#B4BECB] hover:text-[#F2F5F9] p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Bar: Plain pills directly on the page */}
        <div className="space-y-3 min-w-0 w-full">
          {/* Filter 1: Type Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0 w-full">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => handleTypeFilterChange('all')}
                className={`min-h-[44px] px-5 py-2 rounded-full text-[14px] font-semibold transition-all shrink-0 cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-[#2F6BFF] text-white shadow-[0_0_14px_rgba(47,107,255,0.35)]'
                    : 'bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[#B4BECB] hover:text-[#F2F5F9] hover:border-[rgba(255,255,255,0.18)]'
                }`}
              >
                {STRINGS_AR.feed.filterAll}
              </button>

              <button
                type="button"
                onClick={() => handleTypeFilterChange('lost')}
                className={`min-h-[44px] px-5 py-2 rounded-full text-[14px] font-semibold transition-all shrink-0 cursor-pointer ${
                  typeFilter === 'lost'
                    ? 'bg-[#2F6BFF] text-white shadow-[0_0_14px_rgba(47,107,255,0.35)]'
                    : 'bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[#B4BECB] hover:text-[#F2F5F9] hover:border-[rgba(255,255,255,0.18)]'
                }`}
              >
                {STRINGS_AR.feed.filterLost}
              </button>

              <button
                type="button"
                onClick={() => handleTypeFilterChange('found')}
                className={`min-h-[44px] px-5 py-2 rounded-full text-[14px] font-semibold transition-all shrink-0 cursor-pointer ${
                  typeFilter === 'found'
                    ? 'bg-[#2F6BFF] text-white shadow-[0_0_14px_rgba(47,107,255,0.35)]'
                    : 'bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[#B4BECB] hover:text-[#F2F5F9] hover:border-[rgba(255,255,255,0.18)]'
                }`}
              >
                {STRINGS_AR.feed.filterFound}
              </button>
            </div>

            {(typeFilter !== 'all' || categoryFilter !== 'all' || searchInput) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] text-[14px] text-[#4D9BFF] hover:underline flex items-center gap-1.5 font-medium py-1 px-3 rounded-full shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>{STRINGS_AR.feed.resetFilters}</span>
              </button>
            )}
          </div>

          {/* Filter 2: Category chips with soft fade mask at scrolling edge */}
          <div className="relative min-w-0 w-full">
            <div
              className="flex gap-2 overflow-x-auto min-w-0 w-full -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 pb-1 pt-0.5 scrollbar-none"
              style={{
                maskImage:
                  'linear-gradient(to left, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to left, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
              }}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => handleCategoryFilterChange(cat.id as ItemCategory | 'all')}
                    className={`min-h-[44px] px-4 py-2 rounded-full text-[14px] font-medium transition-all shrink-0 select-none whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#2F6BFF] text-white font-semibold shadow-[0_0_12px_rgba(47,107,255,0.35)]'
                        : 'bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[#B4BECB] hover:text-[#F2F5F9] hover:border-[rgba(255,255,255,0.18)]'
                    }`}
                  >
                    {cat.labelAr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Result Count and Quick Action Button on ONE line */}
      <div className="flex items-center justify-between pt-1 min-w-0 w-full px-1 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-bold text-[#F2F5F9]">
            {pluralize(filteredItems.length, {
              singular: 'بلاغ واحد',
              dual: 'بلاغان',
              plural: 'بلاغات',
              accusative: 'بلاغاً',
              zero: 'لا توجد بلاغات',
            })}
          </span>
          <span className="text-[13px] text-[#B4BECB] hidden sm:inline">
            · {STRINGS_AR.feed.activeFirstNote}
          </span>
        </div>

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={onNavigateToPost}
          className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#2F6BFF] text-white text-[13px] font-bold hover:bg-[#2F6BFF] hover:shadow-[0_0_14px_rgba(47,107,255,0.4)] active:scale-[0.98] transition-all inline-flex items-center gap-1.5 shadow-[0_0_10px_rgba(47,107,255,0.25)] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة بلاغ</span>
        </button>
      </div>

      {/* Responsive Grid: 1 below 640px, 2 at 640-1023px, 3 at 1024-1535px, 4 at >=1536px */}
      {isSearching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[clamp(14px,1.6vw,24px)] min-w-0 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : displayedItems.length > 0 ? (
        <div className="space-y-8 min-w-0 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[clamp(14px,1.6vw,24px)] min-w-0 w-full">
            {displayedItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  delay: Math.min(index * 0.04, 0.28),
                  ease: 'easeOut',
                }}
              >
                <ItemCard item={item} onSelect={onSelectItem} />
              </motion.div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="min-h-[48px] px-8 py-3 rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] text-[#4D9BFF] hover:border-[#4D9BFF] font-semibold text-[15px] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] inline-flex items-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <span>{STRINGS_AR.feed.loadMore}</span>
                <span className="text-[14px] text-[#B4BECB] font-mono">
                  ({toArabicDigits(filteredItems.length - displayedItems.length)} متبقٍ)
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-6 text-center rounded-[24px] bg-[#101216] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] max-w-md mx-auto my-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#16191F] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#4D9BFF]">
            <ShieldIcon size={32} className="text-[#4D9BFF]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[18px] font-bold text-[#F2F5F9]">
              {STRINGS_AR.feed.emptyTitle}
            </h3>
            <p className="text-[15px] text-[#B4BECB]">
              {STRINGS_AR.feed.emptyDesc}
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            {categoryFilter !== 'all' || typeFilter !== 'all' || searchInput ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#2F6BFF] text-white text-[15px] font-semibold hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] active:scale-[0.98] transition-all inline-flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)]"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>عرض جميع البلاغات</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToPost}
                className="min-h-[48px] px-6 py-2.5 rounded-full bg-[#2F6BFF] text-white text-[15px] font-semibold hover:bg-[#2F6BFF] hover:shadow-[0_0_20px_rgba(47,107,255,0.4)] active:scale-[0.98] transition-all inline-flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(47,107,255,0.3)]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{STRINGS_AR.feed.addNewCTA}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
