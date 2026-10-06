import { GoogleGenAI } from '@google/genai';

// وسيط الذكاء الاصطناعي على Netlify: المفتاح يبقى هنا في الخادم ولا يصل إلى المتصفح.
// الواجهة ترسل الطلب إلى /api/gemini وهذا الملف يكلّم Gemini ويرجّع النتيجة.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-3.8-flash,gemini-3.5-flash')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean);
const RETRYABLE = /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED|404|NOT_FOUND/i;
const MAX_PROMPT_CHARS = 40000;
const MAX_IMAGE_BASE64_CHARS = 5_500_000; // حد Netlify للطلب نحو 6 ميجابايت

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY is not set on the server' });

  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 25000 } });

  try {
    if (payload.kind === 'embed') {
      const text = String(payload.text || '').trim().slice(0, 1000);
      if (!text) return json(400, { error: 'Empty text' });
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { outputDimensionality: 768 },
      });
      return json(200, { values: response.embeddings?.[0]?.values || null });
    }

    if (payload.kind === 'generate') {
      const prompt = String(payload.prompt || '');
      if (!prompt || prompt.length > MAX_PROMPT_CHARS) return json(400, { error: 'Invalid prompt' });
      const parts: any[] = [{ text: prompt }];
      const image = payload.inlineData;
      if (image?.data && image?.mimeType) {
        if (String(image.data).length > MAX_IMAGE_BASE64_CHARS) return json(413, { error: 'Image too large' });
        parts.push({ inlineData: { mimeType: String(image.mimeType), data: String(image.data) } });
      }

      let lastError: any = null;
      for (const model of MODELS) {
        try {
          const response = await ai.models.generateContent({ model, contents: parts, config: payload.config || {} });
          return json(200, { data: JSON.parse((response.text || '').trim()) });
        } catch (error: any) {
          lastError = error;
          if (!RETRYABLE.test(String(error?.message))) break;
        }
      }
      throw lastError || new Error('All model attempts failed');
    }

    return json(400, { error: 'Unknown kind' });
  } catch (error: any) {
    console.error('gemini function error:', error);
    return json(502, { error: 'AI request failed', details: String(error?.message).slice(0, 300) });
  }
};
