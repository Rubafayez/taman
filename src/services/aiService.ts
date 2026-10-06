// للنشر العام، انقل هذه النداءات إلى Supabase Edge Function حتى لا ينكشف المفتاح في المتصفح.

import { GoogleGenAI, Type } from '@google/genai';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CampusItem, AutoMatchResult, ItemCategory } from '../types';
import { findAutoMatches, isMyItemReport } from '../utils/matching';
import { MATCH_WEIGHTS } from '../config/constants';
import { toArabicDigits } from '../config/strings.ar';
import { mapRowToItem } from './itemMapper';

export interface PhotoAnalysisResult {
  category: ItemCategory;
  title: string;
  description: string;
  colors: string[];
  brand: string;
  distinguishing_marks: string[];
  confidence: number;
  lowConfidence?: boolean;
}

export interface ClaimAssessmentResult {
  confidence: number; // 0 to 100
  assessment: string;
}

export interface PrivacyRisk {
  type: 'phone' | 'national_id' | 'student_id' | 'email' | 'bank' | 'address' | 'over_identifying';
  excerpt: string;
  severity: 'high' | 'medium';
  message: string;
  action: 'remove' | 'move_to_verification';
}

export interface PrivacyReviewResult {
  risks: PrivacyRisk[];
  safe_description: string;
  suggested_verification_question: string;
}

export interface ImagePrivacyResult {
  is_identity_document: boolean;
  document_type:
    | 'national_id'
    | 'iqama'
    | 'university_id'
    | 'passport'
    | 'bank_card'
    | 'driver_license'
    | 'none';
  visible_sensitive_fields: string[];
  recommendation: 'block' | 'mask' | 'allow';
  reason?: string;
  suggested_verification_question?: string;
  fallbackNotice?: string;
}

// In-memory cache for privacy review results per text
const privacyReviewCache = new Map<string, PrivacyReviewResult>();

const VALID_CATEGORIES: ItemCategory[] = [
  'student_id',
  'keys',
  'electronics',
  'chargers',
  'bags_wallets',
  'books_supplies',
  'other',
];

// Read API key from environment
function getGeminiApiKey(): string {
  const envKey =
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.API_KEY) ||
    ((import.meta as any)?.env?.VITE_GEMINI_API_KEY) ||
    ((import.meta as any)?.env?.GEMINI_API_KEY) ||
    '';
  return envKey.trim();
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const key = getGeminiApiKey();
  if (!key) return null;
  aiClient = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiClient;
}

/**
 * Executes generateContent with model fallback in case of temporary 503 demand spikes.
 */
async function generateWithFallback(
  prompt: string,
  config: any,
  inlineData?: { mimeType: string; data: string }
): Promise<any> {
  const ai = getAiClient();
  // بدون مفتاح في المتصفح (الموقع المنشور): الطلب يمر من وسيط الخادم /api/gemini الذي يحمل المفتاح
  if (!ai) {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'generate', prompt, config, inlineData }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.details || result.error || `AI proxy error ${response.status}`);
    return result.data;
  }

  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const parts: any[] = [{ text: prompt }];
      if (inlineData) {
        parts.push({
          inlineData: {
            mimeType: inlineData.mimeType,
            data: inlineData.data,
          },
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: parts,
        config,
      });

      const rawText = response.text || '';
      return JSON.parse(rawText.trim());
    } catch (err: any) {
      lastError = err;
      // If 503 or 429, continue to next fallback model
      if (err?.status === 503 || err?.status === 429 || err?.message?.includes('503')) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('All model attempts failed');
}

/**
 * Calculates cosine similarity between two vectors (for client-side fallback)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getCurrentDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('taman:device_id') || 'default-device-id';
    }
  } catch {}
  return 'default-device-id';
}

/**
 * Fetches full item rows from the items table for a list of UUIDs.
 * Used when match_items RPC returns only { id, similarity }.
 */
async function fetchFullItemsByIds(ids: string[]): Promise<CampusItem[]> {
  if (!ids || ids.length === 0 || !isSupabaseConfigured) return [];
  try {
    const deviceId = getCurrentDeviceId();
    const { data, error } = await supabase
      .from('items')
      .select('*, claims(*)')
      .in('id', ids);

    if (error) {
      console.warn('Error fetching full item rows from items table:', error.message);
      return [];
    }

    return (data || []).map((row) => mapRowToItem(row, deviceId));
  } catch (err) {
    console.warn('fetchFullItemsByIds exception:', err);
    return [];
  }
}

export const aiService = {
  /**
   * FEATURE 1: صوّر وانشر — Auto-fill the report from a photo using @google/genai SDK
   * Enforces a 12-second timeout and fails silently/gracefully to manual entry.
   * Uses structured JSON output with explicit response schema.
   */
  async analyzePhoto(
    photoBase64: string,
    type: 'lost' | 'found' = 'found',
    timeoutMs = 12000
  ): Promise<PhotoAnalysisResult | null> {
    if (!photoBase64) return null;

    try {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('AI analysis timed out')), timeoutMs)
      );

      const cleanBase64 = photoBase64.replace(/^data:[^;]+;base64,/, '');
      const mimeMatch = photoBase64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const prompt = `أنت خبير تصنيف المفقودات والموجودات في الحرم الجامعي (جامعة الملك سعود).
هذا بلاغ من نوع "${type === 'lost' ? 'مفقود' : 'معثور عليه'}".
حلل صورة الغرض بدقة وحدد:
١. الفئة (category): يجب أن تكون واحدة فقط من: student_id, keys, electronics, chargers, bags_wallets, books_supplies, other.
   - student_id: بطاقة جامعية أو بطاقة هوية أو رخصة
   - keys: مفاتيح، ريموت سيارة، بطاقة دخول
   - electronics: جوال، سماعات، لابتوب، آيباد، ساعة ذكية
   - chargers: شواحن، أسلاك، بنك طاقة
   - bags_wallets: حقائب ظهر، محافظ، حقائب يد
   - books_supplies: كتب، دفاتر، أدوات دراسية، حاسبة
   - other: نظارات، مظلات، قارورة ماء، أو أي شيء آخر
٢. العنوان (title): عنوان مختصر جداً وواضح باللغة العربية (٣ إلى ٦ كلمات).
٣. الوصف (description): وصف تفصيلي أمين وموضوعي باللغة العربية (بين ١٥ و١٥٠ حرفاً) يصف اللون، الموديل، العلامات الواضحة والحالة العامة.
٤. الألوان (colors): قائمة بأسماء الألوان البارزة بالعربية.
٥. الماركة أو العلامة التجارية (brand): اسم العلامة إن وجدت، أو "غير محدد".
٦. العلامات المميزة (distinguishing_marks): أي خدوش، ملصقات، أو تفاصيل فريدة.
٧. درجة الثقة (confidence): رقم عشري بين 0.0 و 1.0 يعبر عن مدى وضوح وتأكد التعرف على الغرض.

أرجع الإجابة حصراً بصيغة JSON وفق المخطط المطلوب.`;

      const config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: VALID_CATEGORIES,
            },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            brand: { type: Type.STRING },
            distinguishing_marks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            confidence: { type: Type.NUMBER },
          },
          required: [
            'category',
            'title',
            'description',
            'colors',
            'brand',
            'distinguishing_marks',
            'confidence',
          ],
        },
      };

      const taskPromise = generateWithFallback(prompt, config, {
        mimeType,
        data: cleanBase64,
      });

      const parsed: any = await Promise.race([taskPromise, timeoutPromise]);
      if (!parsed) return null;

      const confidence = Number(parsed.confidence) || 0;

      if (confidence < 0.5) {
        return {
          category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
          title: parsed.title || '',
          description: parsed.description || '',
          colors: Array.isArray(parsed.colors) ? parsed.colors : [],
          brand: parsed.brand || '',
          distinguishing_marks: Array.isArray(parsed.distinguishing_marks)
            ? parsed.distinguishing_marks
            : [],
          confidence,
          lowConfidence: true,
        };
      }

      return {
        category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
        title: (parsed.title || '').trim(),
        description: (parsed.description || '').trim(),
        colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        brand: parsed.brand || '',
        distinguishing_marks: Array.isArray(parsed.distinguishing_marks)
          ? parsed.distinguishing_marks
          : [],
        confidence,
        lowConfidence: false,
      };
    } catch (err) {
      console.warn('Photo analysis non-blocking error:', err);
      return null;
    }
  },

  /**
   * FEATURE: حارس الخصوصية للصور (Photo Privacy Check)
   * Examines every uploaded image for identity documents (national ID, student card, passport, bank card)
   * and personal visible text before it is published.
   */
  async checkPhotoPrivacy(
    photoBase64: string,
    timeoutMs = 12000
  ): Promise<ImagePrivacyResult> {
    if (!photoBase64) {
      return {
        is_identity_document: false,
        document_type: 'none',
        visible_sensitive_fields: [],
        recommendation: 'allow',
      };
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Photo privacy check timed out')), timeoutMs)
      );

      const cleanBase64 = photoBase64.replace(/^data:[^;]+;base64,/, '');
      const mimeMatch = photoBase64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const prompt = `أنت "حارس الخصوصية للصور" في منصة تأمن (Campus Lost & Found) في جامعة الملك سعود.
مهمتك: فحص صورة الغرض المرفوعة بدقة فائقة للتأكد من عدم كشف أي وثائق هوية أو بيانات شخصية حساسة قبل النشر العام.

قواعد التقييم الصارمة:
١. وثيقة هوية رسمية (is_identity_document: true, recommendation: "block"):
   - بطاقة جامعية (university_id) أو كارنيه طالب (سواء جامعة الملك سعود أو غيرها).
   - بطاقة هوية وطنية (national_id) أو بطاقة إقامة (iqama).
   - رخصة قيادة (driver_license).
   - جواز سفر (passport).
   - بطاقة بنكية أو صراف آلي أو ائتمانية (bank_card).
   - إذا ظهر في الصورة أي من هذه الوثائق الرسمية مع اسم أو رقم هوية أو رقم جامعي أو صورة شخصية أو رقم تسلسلي أو باركود، يجب حظر نشر الصورة فوراً (recommendation: "block") لحماية الطالب من انتحال الشخصية وسرقة الهوية.

٢. نصوص شخصية قابلة للتمويه (recommendation: "mask", is_identity_document: false):
   - الغرض ليس وثيقة هوية، بل غرض جامعي عادي (مثل كتاب، دفتر، حقيبة، مظلة، شاحن)، ولكنه يحتوي على رقم هاتف واضح مكتوب، أو اسم شخص مكتوب على غلاف أو ملصق خارجي.
   - في هذه الحالة نوصي بتمويه وإخفاء الجزء الحساس دون حظر الغرض كاملاً.

٣. مسموح بالنشر (recommendation: "allow", is_identity_document: false):
   - صورة غرض عادي (مفاتيح، سماعات، نظارة، ملابس، حاسبة) خالية من وثائق الهوية أو بيانات الاتصال الشخصية المكشوفة.

٤. الحقول الحساسة المكتشفة (visible_sensitive_fields):
   - اختر من بين: ["id_number", "student_number", "serial_number", "full_name", "face_photo", "barcode"].

٥. سؤال التحقق المقترح (suggested_verification_question):
   - إذا كانت الصورة لوثيقة هوية، صِغ سؤال تحقق ذكي لا يعرف إجابته إلا صاحب البطاقة الحقيقي (مثال: "ما هما آخر رقمين في البطاقة الجامعية؟" أو "ما هو الاسم الكامل المدون في البطاقة؟").

أرجع النتيجة بصيغة JSON حصراً وفق المخطط المحدد.`;

      const config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_identity_document: { type: Type.BOOLEAN },
            document_type: {
              type: Type.STRING,
              enum: [
                'national_id',
                'iqama',
                'university_id',
                'passport',
                'bank_card',
                'driver_license',
                'none',
              ],
            },
            visible_sensitive_fields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendation: {
              type: Type.STRING,
              enum: ['block', 'mask', 'allow'],
            },
            reason: { type: Type.STRING },
            suggested_verification_question: { type: Type.STRING },
          },
          required: [
            'is_identity_document',
            'document_type',
            'visible_sensitive_fields',
            'recommendation',
          ],
        },
      };

      const taskPromise = generateWithFallback(prompt, config, {
        mimeType,
        data: cleanBase64,
      });

      const parsed: any = await Promise.race([taskPromise, timeoutPromise]);

      if (parsed && typeof parsed.is_identity_document === 'boolean') {
        const isDoc = Boolean(parsed.is_identity_document);
        return {
          is_identity_document: isDoc,
          document_type: parsed.document_type || (isDoc ? 'university_id' : 'none'),
          visible_sensitive_fields: Array.isArray(parsed.visible_sensitive_fields)
            ? parsed.visible_sensitive_fields
            : [],
          recommendation: parsed.recommendation || (isDoc ? 'block' : 'allow'),
          reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
          suggested_verification_question:
            typeof parsed.suggested_verification_question === 'string'
              ? parsed.suggested_verification_question
              : undefined,
        };
      }

      throw new Error('Invalid JSON response');
    } catch (err) {
      console.warn('Photo privacy check failed, falling back to gentle reminder:', err);
      return {
        is_identity_document: false,
        document_type: 'none',
        visible_sensitive_fields: [],
        recommendation: 'allow',
        fallbackNotice: 'تأكد أن الصورة لا تُظهر أرقام هويتك.',
      };
    }
  },

  /**
   * Suggests 3 smart verification questions for a found item.
   * Structured JSON output with explicit responseSchema.
   */
  async suggestVerificationQuestions(
    description: string,
    title?: string,
    timeoutMs = 8000
  ): Promise<string[]> {
    if (!description || description.trim().length < 5) {
      return [];
    }

    try {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Question suggestion timed out')), timeoutMs)
      );

      const prompt = `أنت مساعد ذكي لمنصة المفقودات والموجودات في جامعة الملك سعود.
المعلن عثر على غرض وكتب الوصف التالي:
العنوان: ${title || 'غرض موجود'}
الوصف: ${description}

المطلوب:
اقترح بالضبط ٣ أسئلة تحقق عربية قصيرة وذكية يطرحها الواجد على الشخص الذي يدعي أن الغرض ملكه.
شروط الأسئلة:
١. يجب أن تكون إجابة السؤال واضحة للمالك الحقيقي فقط، وغير مذكورة صراحة في الوصف المنشور (مثال: علامة خفية، محتوى الحقيبة الداخلي، خدش محدد، اسم محفور، خلفية شاشة القفل، عدد المفاتيح).
٢. أن يكون كل سؤال واضحاً ومختصراً وباللغة العربية الفصحى البسيطة (لا يقل عن ١٠ أحرف ولا يزيد عن ٦٠ حرفاً).

أرجع الإجابة بتنسيق JSON حصراً:
{
  "questions": ["سؤال ١", "سؤال ٢", "سؤال ٣"]
}`;

      const config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['questions'],
        },
      };

      const taskPromise = generateWithFallback(prompt, config);
      const parsed: any = await Promise.race([taskPromise, timeoutPromise]);

      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions
          .filter((q: any) => typeof q === 'string' && q.trim().length >= 5)
          .slice(0, 3);
      }
      return [];
    } catch (err) {
      console.warn('Suggest verification questions non-blocking error:', err);
      return [];
    }
  },

  /**
   * FEATURE 2: Embeddings for semantic matching.
   * Generates a 768-dimensional text embedding using gemini-embedding-001 with outputDimensionality 768.
   * Runs in background and never throws.
   */
  async embedItem(text: string): Promise<number[] | null> {
    if (!text || text.trim().length === 0) return null;

    try {
      const ai = getAiClient();
      // بدون مفتاح في المتصفح: التضمين يُحسب عبر وسيط الخادم
      if (!ai) {
        const proxied = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'embed', text }),
        });
        if (!proxied.ok) return null;
        const result = await proxied.json().catch(() => ({}));
        return Array.isArray(result.values) && result.values.length > 0 ? result.values : null;
      }

      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text.trim().slice(0, 1000),
        config: {
          outputDimensionality: 768,
        },
      });

      const values = response.embeddings?.[0]?.values;
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
      return null;
    } catch (err) {
      console.warn('Embedding generation non-blocking error:', err);
      return null;
    }
  },

  /**
   * FEATURE 3: Assess verification answer advisory assessment.
   * Structured JSON output with explicit responseSchema: { confidence: integer, assessment: string }.
   */
  async assessClaimAnswer(
    description: string,
    verificationQuestion: string,
    claimantAnswer: string
  ): Promise<ClaimAssessmentResult | null> {
    if (!claimantAnswer || claimantAnswer.trim().length === 0) return null;

    try {
      const prompt = `أنت نظام ذكي لتقييم صحة ومطابقة إجابات طلبات الاسترداد في منصة المفقودات والموجودات بجامعة الملك سعود.
المعلومات المتوفرة:
- وصف الغرض الأصلي المعلن: "${description || 'غير محدد'}"
- سؤال التحقق الموضوع من واجد الغرض: "${verificationQuestion || 'سؤال عام حول مواصفات الغرض'}"
- إجابة الشخص المدعي لملكية الغرض: "${claimantAnswer}"

المهمة:
قيّم مدى مطابقة ومصداقية إجابة المدعي بموضوعية وتأنٍ:
١. احسب نسبة الثقة (confidence) كرقم صحيح بين 0 و 100 وفق المعايير التالية:
   - 70 إلى 100 (تطابق مرتفع): الإجابة تذكر تفاصيل دقيقة أو علامات خاصة أو محتويات غير مذكورة في الوصف العام المعلن وتجيب عن سؤال التحقق بدقة تؤكد الملكية بوضوح (مثال: ريم الحربي تذكر تفاصيل دقيقة وعلامات غير معلنة).
   - 40 إلى 69 (تطابق متوسط): الإجابة صحيحة أو مقبولة في الإطار العام ولكنها عامة وتفتقر للمعلومات الفريدة الخاصة.
   - 0 إلى 39 (تطابق منخفض): الإجابة تكتفي بإعادة صياغة الوصف العام المنشور بكلمات مبهمة دون أي تفصيل جديد، أو تخمينية واضحة، أو غير متوافقة (مثال: خالد المطيري يعيد صياغة نفس الوصف العام بكلمات عامة).
٢. اكتب تقييماً استرشادياً مختصراً جداً (assessment): جملة عربية واحدة فقط واضحة ومفيدة تلخص سبب التقييم (مثال: "الإجابة تقدم تفاصيل دقيقة ومطابقة تؤكد معرفة الغرض", "الإجابة عامة وتكتفي بتكرار الوصف المنشور دون تفاصيل جديدة").

أرجع الإجابة بتنسيق JSON حصراً:
{
  "confidence": 85,
  "assessment": "جملة واحدة باللغة العربية"
}`;

      const config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            confidence: { type: Type.INTEGER },
            assessment: { type: Type.STRING },
          },
          required: ['confidence', 'assessment'],
        },
      };

      const parsed = await generateWithFallback(prompt, config);
      if (!parsed || typeof parsed.confidence !== 'number') {
        return null;
      }

      const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
      const assessment =
        typeof parsed.assessment === 'string'
          ? parsed.assessment.trim()
          : 'تم تقييم الإجابة استرشادياً.';

      return {
        confidence,
        assessment,
      };
    } catch (err) {
      console.warn('Claim answer assessment non-blocking error:', err);
      return null;
    }
  },

  /**
   * FEATURE: حارس الخصوصية (Privacy Guardian)
   * Reviews description before publishing to protect personal data and prevent impersonation.
   */
  async reviewDescription(
    type: 'lost' | 'found' | string,
    category: string,
    description: string
  ): Promise<PrivacyReviewResult | null> {
    const trimmed = description?.trim() || '';
    if (trimmed.length < 10) return null;

    const cacheKey = `${type}:${category}:${trimmed}`;
    if (privacyReviewCache.has(cacheKey)) {
      return privacyReviewCache.get(cacheKey)!;
    }

    try {
      const prompt = `أنت "حارس الخصوصية" في منصة تأمن (Campus Lost & Found) في جامعة الملك سعود.
مهمتك: مراجعة نص وصف الغرض قبل نشره لحماية الطالب من:
١. كشف بياناته الشخصية (أرقام تواصل، هويات، حسابات، عناوين).
٢. الإفراط في التفاصيل (over_identifying) بحيث يمكّن منتحلاً من ادعاء ملكية الغرض بسهولة.

نوع البلاغ: ${type === 'lost' ? 'مفقود' : 'معثور عليه'}
الفئة: ${category || 'عام'}
نص الوصف:
"${trimmed}"

القواعد الدقيقة:
- خطورة عالية حاسمة (severity: "high", action: "remove"):
  ١. بيانات شخصية مباشرة: أرقام جوال (مثل 05xxxxxxxx أو +966)، رقم هوية وطنية أو إقامة، أرقام جامعية كاملة (مثل 44xxxxxxx)، بريد إلكتروني، حساب بنكي أو آيبان، عنوان منزلي محدد.
  ٢. اسم شخص كامل (ثنائي أو ثلاثي)، أو ذكر اسم جامعة (مثل جامعة الملك سعود) أو اسم كلية محددة مع اسم شخص أو مع فئة بطاقة جامعية / هوية (student_id): يجب حظرها فوراً وحذفها من الوصف العام (action: "remove") لمنع كشف هوية صاحب الغرض أو التشهير به.
- خطورة متوسطة (severity: "medium"): تفاصيل مفرطة (type: "over_identifying"): تفصيل فريد يقرأه أي شخص في البلاغ العام فيكرره ليدعي ملكيته (اسم محفور، خلفية شاشة القفل، رقم تسلسلي، ملصق مميز، محتويات حقيبة خاصة).
  - إذا كان البلاغ "معثور عليه" (found): الإفراط في التفاصيل خطير جداً، ويجب نقله ليصبح سؤال تحقق: action: "move_to_verification".
  - إذا كان البلاغ "مفقود" (lost): البيانات الشخصية هي الخطر الأساسي، أما العلامة الفارقة فتنشر إلا إذا كانت تثبت الملكية بمفردها كالسريال.
- لا تخترع مخاطر أبداً. إذا كان الوصف آمناً، أرجع risks كـ [].
- في safe_description: أعد كتابة الوصف بالعربية سليماً دون الأجزاء الخطرة، بنفس المعنى.
- في suggested_verification_question: سؤال تحقق عربي واحد تكون إجابته هي التفصيل المحجوب (أو نص فارغ إذا لم توجد مخاطر تفصيلية).

أرجع النتيجة بصيغة JSON حصراً:
{
  "risks": [
    {
      "type": "phone|national_id|student_id|email|bank|address|over_identifying",
      "excerpt": "النص الدقيق المكتشف",
      "severity": "high|medium",
      "message": "جملة عربية قصيرة تشرح الخطر",
      "action": "remove|move_to_verification"
    }
  ],
  "safe_description": "الوصف بعد تنقيته بالعربية",
  "suggested_verification_question": "سؤال التحقق المقترح"
}`;

      const config = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                  },
                  excerpt: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                  },
                  message: { type: Type.STRING },
                  action: {
                    type: Type.STRING,
                  },
                },
                required: ['type', 'excerpt', 'severity', 'message', 'action'],
              },
            },
            safe_description: { type: Type.STRING },
            suggested_verification_question: { type: Type.STRING },
          },
          required: ['risks', 'safe_description', 'suggested_verification_question'],
        },
      };

      const parsed = await generateWithFallback(prompt, config);
      if (parsed && Array.isArray(parsed.risks)) {
        const cleanedRisks: PrivacyRisk[] = parsed.risks
          .map((r: any) => ({
            type: (r.type as any) || 'over_identifying',
            excerpt: String(r.excerpt || '').trim(),
            severity: (r.severity === 'high' ? 'high' : 'medium') as 'high' | 'medium',
            message: String(r.message || '').trim(),
            action: (r.action === 'move_to_verification'
              ? 'move_to_verification'
              : 'remove') as 'remove' | 'move_to_verification',
          }))
          .filter((r: PrivacyRisk) => r.excerpt.length > 0 && trimmed.includes(r.excerpt));

        const result: PrivacyReviewResult = {
          risks: cleanedRisks,
          safe_description: String(parsed.safe_description || trimmed).trim(),
          suggested_verification_question: String(
            parsed.suggested_verification_question || ''
          ).trim(),
        };

        privacyReviewCache.set(cacheKey, result);
        return result;
      }

      return runLocalPrivacyScan(trimmed, type, category, cacheKey);
    } catch (err) {
      console.warn('Privacy review API failed or skipped, running local scan:', err);
      return runLocalPrivacyScan(trimmed, type, category, cacheKey);
    }
  },

  /**
   * Hybrid Matcher: Combines existing rule-based matching with semantic similarity.
   *
   * Scoring Constitution:
   * 1. Own reports must never appear as matches (isMyItemReport).
   * 2. Exclude same type: a lost report may only match found reports and vice versa.
   * 3. Never show matches for an item that is already resolved.
   * 4. When both items are "أخرى", category contributes 0.
   * 5. A match must not be shown on location + date alone: requires either a specific
   *    shared category OR semantic similarity >= 0.35; otherwise dropped entirely.
   * 6. Rule-based portion capped at 70. Only semantic similarity pushes above 70 up to 100%.
   * 7. If rule-only, label chip "تطابق مبدئي" (isPreliminary: true).
   * 8. Sort by score descending; on ties, sort by closeness in date.
   * 9. Returns at most 3 matches.
   */
  async findHybridMatches(
    targetItem: CampusItem,
    allPool: CampusItem[] = []
  ): Promise<AutoMatchResult[]> {
    // 1. Never show matches for an item that is already resolved or invalid
    if (!targetItem || !targetItem.category || targetItem.status === 'resolved') {
      return [];
    }

    const currentDeviceId = getCurrentDeviceId();
    const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';

    // 2. Semantic similarities map: itemId -> similarity (0.0 to 1.0)
    const similarities = new Map<string, number>();

    // Ensure targetItem has an embedding if possible
    let targetEmbedding = targetItem.embedding;
    if (!targetEmbedding || !Array.isArray(targetEmbedding) || targetEmbedding.length === 0) {
      const textToEmbed = `${targetItem.title}. ${targetItem.description}. ${targetItem.category}. ${targetItem.location || ''}`;
      try {
        const generated = await this.embedItem(textToEmbed);
        if (generated && Array.isArray(generated) && generated.length > 0) {
          targetEmbedding = generated;
          targetItem.embedding = generated;
        }
      } catch {
        // non-blocking
      }
    }

    // 3. Query semantic matches via match_items RPC
    if (targetEmbedding && Array.isArray(targetEmbedding) && isSupabaseConfigured) {
      try {
        const isValidUuid =
          typeof targetItem.id === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetItem.id);

        const { data: rpcRows, error: rpcErr } = await supabase.rpc('match_items', {
          query_embedding: targetEmbedding,
          opposite_type: oppositeType,
          exclude_id: isValidUuid ? targetItem.id : null,
          match_threshold: 0.35,
          match_count: 10,
        });

        if (!rpcErr && Array.isArray(rpcRows)) {
          for (const row of rpcRows) {
            // Note: match_items returns ONLY two columns: id (uuid) and similarity (float).
            if (row && row.id && typeof row.similarity === 'number') {
              similarities.set(row.id, Number(row.similarity));
            }
          }
        } else if (rpcErr) {
          console.warn('match_items RPC non-blocking error:', rpcErr.message);
        }
      } catch (err) {
        console.warn('match_items RPC non-blocking error:', err);
      }
    }

    // 4. Fallback: compute cosine similarity in memory if both items have embeddings
    if (similarities.size === 0 && targetEmbedding && Array.isArray(targetEmbedding)) {
      for (const candidate of allPool) {
        if (
          candidate.id !== targetItem.id &&
          candidate.type === oppositeType &&
          candidate.status === 'active' &&
          candidate.embedding &&
          Array.isArray(candidate.embedding)
        ) {
          const sim = cosineSimilarity(targetEmbedding, candidate.embedding);
          if (sim >= 0.35) {
            similarities.set(candidate.id, sim);
          }
        }
      }
    }

    // 5. Gather candidates: allPool + any candidates returned by RPC
    const candidateMap = new Map<string, CampusItem>();
    for (const item of allPool) {
      if (
        item.id !== targetItem.id &&
        item.type === oppositeType &&
        item.status === 'active'
      ) {
        candidateMap.set(item.id, item);
      }
    }

    const missingIds = Array.from(similarities.keys()).filter((id) => !candidateMap.has(id));
    if (missingIds.length > 0 && isSupabaseConfigured) {
      try {
        const fetchedItems = await fetchFullItemsByIds(missingIds);
        for (const item of fetchedItems) {
          // Strictly apply exclusions after fetching rows
          if (
            item.id !== targetItem.id &&
            item.type === oppositeType &&
            item.status === 'active'
          ) {
            candidateMap.set(item.id, item);
          } else {
            similarities.delete(item.id);
          }
        }
      } catch (err) {
        console.warn('Error fetching full rows for matched items:', err);
      }
    }

    // Clean up similarities map for any items that turned out to be invalid or self-owned
    for (const id of Array.from(similarities.keys())) {
      if (!candidateMap.has(id)) {
        similarities.delete(id);
      }
    }

    // 6. Score each candidate under the strict scoring constitution
    const isTargetOther = targetItem.category === 'other';
    const targetDate = new Date(targetItem.date).getTime();
    const targetLoc = (targetItem.location || '').trim().toLowerCase();
    const targetKeywords = (targetItem.title || targetItem.description)
      ? new Set(
          `${targetItem.title} ${targetItem.description}`
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 2)
        )
      : new Set<string>();

    const results: AutoMatchResult[] = [];

    for (const candidate of candidateMap.values()) {
      const isBothOther = isTargetOther && candidate.category === 'other';
      const hasSpecificSharedCategory = targetItem.category === candidate.category && !isBothOther;
      const sim = similarities.get(candidate.id);
      const hasSemanticMatch = sim !== undefined && sim >= 0.35;

      // RULE: A match must not be shown on location + date alone.
      // Require either a specific shared category OR a semantic similarity above threshold.
      // Otherwise candidate is dropped entirely!
      if (!hasSpecificSharedCategory && !hasSemanticMatch) {
        continue;
      }

      let ruleScore = 0;
      const reasons: string[] = [];

      // Category weight applies ONLY to specific categories (0 if both are "أخرى")
      if (hasSpecificSharedCategory) {
        ruleScore += MATCH_WEIGHTS.sameCategory; // 40
        reasons.push('نفس الفئة');
      }

      // Location matching
      const candidateLoc = (candidate.location || '').trim().toLowerCase();
      const isSameLocation = Boolean(targetLoc && candidateLoc && targetLoc === candidateLoc);
      if (isSameLocation) {
        ruleScore += MATCH_WEIGHTS.sameLocation; // 25
        reasons.push('نفس الموقع تماماً');
      } else if (targetLoc && candidateLoc) {
        const buildingRegex = /(?:مبنى|قاعة|كلية)\s*([0-9\u0660-\u0669]+|[^\s,]+)/g;
        const targetBuildings = [...targetLoc.matchAll(buildingRegex)].map((m) => m[0]);
        const candidateBuildings = [...candidateLoc.matchAll(buildingRegex)].map((m) => m[0]);
        const sharesBuilding =
          targetLoc.includes(candidateLoc) ||
          candidateLoc.includes(targetLoc) ||
          targetBuildings.some((b) => candidateLoc.includes(b)) ||
          candidateBuildings.some((b) => targetLoc.includes(b)) ||
          (targetItem.buildingNumber && targetItem.buildingNumber === candidate.buildingNumber);

        if (sharesBuilding) {
          ruleScore += MATCH_WEIGHTS.nearbyBuilding; // 15
          reasons.push('مبنى أو كلية مشتركة');
        }
      }

      // Date within 7 days
      const candidateDate = new Date(candidate.date).getTime();
      const diffDays = Math.abs(targetDate - candidateDate) / (1000 * 60 * 60 * 24);
      if (!isNaN(diffDays) && diffDays <= 7) {
        ruleScore += MATCH_WEIGHTS.dateWithin7Days; // 20
        const roundedDays = Math.round(diffDays);
        reasons.push(roundedDays === 0 ? 'نفس اليوم' : `خلال ${toArabicDigits(roundedDays)} أيام`);
      }

      // Description keyword overlap
      const candidateKeywords = `${candidate.title} ${candidate.description}`
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);
      let commonCount = 0;
      for (const kw of candidateKeywords) {
        if (targetKeywords.has(kw)) {
          commonCount++;
        }
      }
      if (commonCount > 0) {
        ruleScore += MATCH_WEIGHTS.keywordOverlap; // 15
        reasons.push(`تطابق وصف (${toArabicDigits(commonCount)} كلمات دلالية)`);
      }

      // Cap rule-based portion at 70. Only semantic component can push above that!
      const cappedRuleScore = Math.min(70, ruleScore);

      let finalScore = cappedRuleScore;
      let isPreliminary = true;

      if (hasSemanticMatch && sim !== undefined) {
        // Semantic component pushes above 70 up to 100
        const semanticScore = Math.round(sim * 30);
        finalScore = Math.min(100, cappedRuleScore + semanticScore);
        if (!reasons.includes('تشابه في الوصف ✨')) {
          reasons.push('تشابه في الوصف ✨');
        }
        isPreliminary = false; // Verified with semantic embeddings
      }

      if (finalScore >= MATCH_WEIGHTS.minMatchScore) {
        results.push({
          matchedItem: candidate,
          score: finalScore,
          matchReasons: reasons,
          isPreliminary,
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
  },
};

/**
 * Fallback regex-based privacy scanner if AI call is unavailable or network error.
 */
function runLocalPrivacyScan(
  text: string,
  type: string,
  category?: string,
  cacheKey?: string
): PrivacyReviewResult {
  const risks: PrivacyRisk[] = [];
  let safeDescription = text;

  // 1. Phone number (05xxxxxxxx or +9665xxxxxxxx)
  const phoneMatches = text.match(/(?:(?:\+?966)|0)?5\d{8}/g);
  if (phoneMatches) {
    for (const p of phoneMatches) {
      if (!risks.some((r) => r.excerpt === p)) {
        risks.push({
          type: 'phone',
          excerpt: p,
          severity: 'high',
          message: 'رقم جوال قد يعرّض خصوصيتك للخطر',
          action: 'remove',
        });
        safeDescription = safeDescription.replace(p, '').replace(/\s{2,}/g, ' ');
      }
    }
  }

  // 2. Email
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    for (const em of emailMatches) {
      if (!risks.some((r) => r.excerpt === em)) {
        risks.push({
          type: 'email',
          excerpt: em,
          severity: 'high',
          message: 'بريد إلكتروني شخصي',
          action: 'remove',
        });
        safeDescription = safeDescription.replace(em, '').replace(/\s{2,}/g, ' ');
      }
    }
  }

  // 3. National ID (10 digits starting with 1 or 2)
  const idMatches = text.match(/\b[12]\d{9}\b/g);
  if (idMatches) {
    for (const id of idMatches) {
      if (!risks.some((r) => r.excerpt === id)) {
        risks.push({
          type: 'national_id',
          excerpt: id,
          severity: 'high',
          message: 'رقم هوية وطنية أو إقامة شخصية',
          action: 'remove',
        });
        safeDescription = safeDescription.replace(id, '').replace(/\s{2,}/g, ' ');
      }
    }
  }

  // 4. Student ID (43xxxxxxx or 44xxxxxxx)
  const sidMatches = text.match(/\b4[34]\d{7}\b/g);
  if (sidMatches) {
    for (const sid of sidMatches) {
      if (!risks.some((r) => r.excerpt === sid)) {
        risks.push({
          type: 'student_id',
          excerpt: sid,
          severity: 'high',
          message: 'رقم جامعي كامل يحدد هويتك',
          action: 'remove',
        });
        safeDescription = safeDescription.replace(sid, '').replace(/\s{2,}/g, ' ');
      }
    }
  }

  // 5. University, College, or full name together with ID category
  const isIdContext =
    category === 'student_id' ||
    /(?:بطاقة|هوية|كارنيه|طالب|جامعي|جامعية)/i.test(text);

  if (isIdContext) {
    // College or University affiliation
    const affiliationMatches = text.match(/(?:جامعة\s+الملك\s+سعود|كلية\s+[\p{L}]+(?:\s+[\p{L}]+)?)/gui);
    if (affiliationMatches) {
      for (const aff of affiliationMatches) {
        if (!risks.some((r) => r.excerpt === aff)) {
          risks.push({
            type: 'student_id',
            excerpt: aff,
            severity: 'high',
            message: 'ذكر اسم الكلية أو الجامعة مع بطاقة الهوية يجب حذفه لحماية الخصوصية',
            action: 'remove',
          });
          safeDescription = safeDescription.replace(aff, '').replace(/\s{2,}/g, ' ');
        }
      }
    }

    // Person full name pattern (e.g. للطالب فلان الفلاني, باسم ...)
    const nameMatches = text.match(/(?:طالب|طالبة|باسم|للطالب|للطالبة|الاسم[:\s]|صاحبها|صاحبته)\s+([\p{L}]+\s+[\p{L}]+(?:\s+[\p{L}]+)?)/gui);
    if (nameMatches) {
      for (const nm of nameMatches) {
        if (!risks.some((r) => r.excerpt === nm)) {
          risks.push({
            type: 'student_id',
            excerpt: nm,
            severity: 'high',
            message: 'ذكر الاسم الكامل مع وثيقة الهوية يعرض الخصوصية للخطر ويجب حذفه',
            action: 'remove',
          });
          safeDescription = safeDescription.replace(nm, '').replace(/\s{2,}/g, ' ');
        }
      }
    }
  }

  const result: PrivacyReviewResult = {
    risks,
    safe_description: safeDescription.trim(),
    suggested_verification_question:
      risks.length > 0 && type === 'found' ? 'ما هي العلامة المميزة في الغرض؟' : '',
  };

  if (cacheKey) {
    privacyReviewCache.set(cacheKey, result);
  }
  return result;
}
