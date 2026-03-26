import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RiskLevel = 'low' | 'medium' | 'high';

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return a JSON object.');
  return JSON.parse(match[0]);
}

function isRiskLevel(v: unknown): v is RiskLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const obj = body as Record<string, unknown>;
    const textRaw = obj.text;
    const contextRaw = obj.context;
    const imageDataUrlsRaw = obj.image_data_urls;

    const text = typeof textRaw === 'string' ? textRaw : '';
    const context = typeof contextRaw === 'string' ? contextRaw : '';

    // text/context are optional now; require at least one of (text, images)
    if (text.trim().length === 0 && (imageDataUrlsRaw === undefined || (Array.isArray(imageDataUrlsRaw) && imageDataUrlsRaw.length === 0))) {
      return Response.json(
        { error: 'Provide at least one of: non-empty "text" or "image_data_urls".' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OPENAI_API_KEY is not set.' }, { status: 500 });
    }

    const imageDataUrls =
      imageDataUrlsRaw === undefined
        ? []
        : Array.isArray(imageDataUrlsRaw) && imageDataUrlsRaw.every((x) => typeof x === 'string')
          ? (imageDataUrlsRaw as string[])
          : null;

    if (imageDataUrls === null) {
      return Response.json({ error: 'image_data_urls must be string[] when provided.' }, { status: 400 });
    }

    type VisionTextPart = { type: 'text'; text: string };
    type VisionImagePart = { type: 'image_url'; image_url: { url: string } };
    const userParts: Array<VisionTextPart | VisionImagePart> = [
      {
        type: 'text',
        text: `对方消息（可为空）：\n${text || '（未提供）'}\n\n背景（可为空）：\n${context || '（未提供）'}\n\n请只输出合法 JSON，不要 markdown。所有中文文案字段必须用简体中文书写：surface_meaning、subtext、suggestion。\nemotion_score 用 0–10 的浮点数或整数表示。\nrisk_level 仅使用英文枚举：low、medium、high。\n\nJSON 结构：\n{
  "surface_meaning": string,
  "subtext": string,
  "emotion_score": number,
  "risk_level": "low" | "medium" | "high",
  "suggestion": string
}`,
      },
    ];

    for (const url of imageDataUrls) {
      userParts.push({ type: 'image_url', image_url: { url } });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是关系沟通分析助手。只输出符合约定字段结构的 JSON，不要 markdown 代码块。surface_meaning、subtext、suggestion 必须写简体中文。risk_level 只能是 low、medium、high。',
        },
        {
          role: 'user',
          content: userParts,
        },
      ],
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = extractJson(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return Response.json({ error: 'Model output is not an object.' }, { status: 500 });
    }

    const p = parsed as Partial<{
      surface_meaning: unknown;
      subtext: unknown;
      emotion_score: unknown;
      risk_level: unknown;
      suggestion: unknown;
    }>;

    if (typeof p.surface_meaning !== 'string' || typeof p.subtext !== 'string') {
      return Response.json({ error: 'Model output missing required string fields.' }, { status: 500 });
    }

    const emotionScore =
      typeof p.emotion_score === 'number' && Number.isFinite(p.emotion_score) ? p.emotion_score : null;
    if (emotionScore === null) {
      return Response.json({ error: 'Model output emotion_score must be a finite number.' }, { status: 500 });
    }

    if (!isRiskLevel(p.risk_level)) {
      return Response.json({ error: 'Model output risk_level must be low|medium|high.' }, { status: 500 });
    }

    if (typeof p.suggestion !== 'string') {
      return Response.json({ error: 'Model output suggestion must be a string.' }, { status: 500 });
    }

    return Response.json({
      surface_meaning: p.surface_meaning,
      subtext: p.subtext,
      emotion_score: emotionScore,
      risk_level: p.risk_level,
      suggestion: p.suggestion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get interpret response.';
    console.error('Interpret API error:', error);
    return Response.json({ error: message }, { status: 500 });
  }
}

