-- ==============================================================================
-- سياسات أمان مستوى الصفوف (Row Level Security - RLS) لمشروع "تأمن" (Ta'man)
-- متوافق تماماً مع Supabase و PostgreSQL
-- يتيح عمليات: الإضافة (INSERT) والتعديل (UPDATE) والحذف (DELETE) والقراءة (SELECT)
-- ==============================================================================

-- 1. تفعيل ميزة RLS على الجداول
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- 2. تنظيف أي سياسات سابقة لتفادي أي تعارض
DROP POLICY IF EXISTS "Allow public read items" ON items;
DROP POLICY IF EXISTS "Allow public insert items" ON items;
DROP POLICY IF EXISTS "Allow public update items" ON items;
DROP POLICY IF EXISTS "Allow public delete items" ON items;
DROP POLICY IF EXISTS "Enable all access for items" ON items;

DROP POLICY IF EXISTS "Allow public read claims" ON claims;
DROP POLICY IF EXISTS "Allow public insert claims" ON claims;
DROP POLICY IF EXISTS "Allow public update claims" ON claims;
DROP POLICY IF EXISTS "Allow public delete claims" ON claims;
DROP POLICY IF EXISTS "Enable all access for claims" ON claims;

-- ==============================================================================
-- سياسات جدول البلاغات (items)
-- ==============================================================================

-- أ) سياسة القراءة (SELECT): تتيح لجميع زوار وطلاب الحرم الجامعي استعراض البلاغات
CREATE POLICY "Allow public read items"
ON items
FOR SELECT
TO anon, authenticated
USING (true);

-- ب) سياسة الإضافة (INSERT): تتيح نشر بلاغ جديد عن مفقود أو معثور عليه
CREATE POLICY "Allow public insert items"
ON items
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ج) سياسة التعديل (UPDATE): تتيح تعديل البلاغ وتسليمه وتحديث الحالة
CREATE POLICY "Allow public update items"
ON items
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- د) سياسة الحذف (DELETE): تتيح حذف البلاغ من قبل المستخدم
CREATE POLICY "Allow public delete items"
ON items
FOR DELETE
TO anon, authenticated
USING (true);

-- ==============================================================================
-- سياسات جدول طلبات الاسترداد (claims)
-- ==============================================================================

-- أ) سياسة القراءة (SELECT): تتيح قراءة طلبات الاسترداد المرتبطة بالبلاغات
CREATE POLICY "Allow public read claims"
ON claims
FOR SELECT
TO anon, authenticated
USING (true);

-- ب) سياسة الإضافة (INSERT): تتيح للطلاب تقديم طلب استرداد على غرض معثور عليه
CREATE POLICY "Allow public insert claims"
ON claims
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ج) سياسة التعديل (UPDATE): تتيح قبول أو رفض طلبات الاسترداد
CREATE POLICY "Allow public update claims"
ON claims
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- د) سياسة الحذف (DELETE): تتيح حذف طلبات الاسترداد عند الحاجة
CREATE POLICY "Allow public delete claims"
ON claims
FOR DELETE
TO anon, authenticated
USING (true);

-- ==============================================================================
-- وظيفة المطابقة الدلالية الذكية (Semantic Vector Matching RPC)
-- ملاحظة هامة: ترجع الدالة فقط عمودين: id (uuid) و similarity (float)
-- ويتم جلب بقية تفاصيل البلاغ (العنوان، الوصف، الفئة، الموقع، الصورة، التاريخ) من جدول items
-- ==============================================================================

-- تفعيل ملحق المتجهات pgvector (في حال لم يكن مفعلاً)
CREATE EXTENSION IF NOT EXISTS vector;

-- إنشاء دالة المطابقة الدلالية match_items
CREATE OR REPLACE FUNCTION match_items (
  query_embedding vector(768),
  opposite_type text,
  exclude_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.35,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    items.id,
    (1 - (items.embedding <=> query_embedding))::float AS similarity
  FROM items
  WHERE items.status = 'active'
    AND items.type = opposite_type
    AND (exclude_id IS NULL OR items.id != exclude_id)
    AND items.embedding IS NOT NULL
    AND (1 - (items.embedding <=> query_embedding)) >= match_threshold
  ORDER BY items.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

