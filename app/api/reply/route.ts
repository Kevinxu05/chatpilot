import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return a JSON object.');
  return JSON.parse(match[0]);
}

function isStringRecordArray(v: unknown): v is Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return false;
  return v.every((x) => !!x && typeof x === 'object' && !Array.isArray(x));
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
        text: `对方消息（可为空）：\n${text || '（未提供）'}\n\n背景（可为空）：\n${context || '（未提供）'}\n\n只输出合法 JSON，不要 markdown。analysis 与 replies 中每条 content 必须用简体中文。\nreplies 必须恰好三条，label 必须严格为「克制版」「幽默版」「高情商版」（与 schema 一致）。\n\nJSON 结构：\n{
  "analysis": string,
  "replies": [
    { "label": "克制版", "content": string },
    { "label": "幽默版", "content": string },
    { "label": "高情商版", "content": string }
  ]
}`,
      },
    ];

    for (const url of imageDataUrls) {
      userParts.push({ type: 'image_url', image_url: { url } });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            '你是关系沟通回复助手。只输出约定字段结构的 JSON，不要 markdown 代码块。analysis 与各条 reply 的 content 必须写简体中文。',
        },
        {
          role: 'user',
          content: userParts,
        },
      ],
      max_tokens: 900,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = extractJson(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return Response.json({ error: 'Model output is not an object.' }, { status: 500 });
    }

    const p = parsed as Partial<{
      analysis: unknown;
      replies: unknown;
    }>;

    if (typeof p.analysis !== 'string') {
      return Response.json({ error: 'Model output missing "analysis" string.' }, { status: 500 });
    }

    if (!isStringRecordArray(p.replies)) {
      return Response.json({ error: 'Model output "replies" must be an array.' }, { status: 500 });
    }

    const allowedLabels = new Set(['克制版', '幽默版', '高情商版']);
    const repliesParsed = p.replies
      .map((r) => {
        const label = typeof r.label === 'string' ? r.label : '';
        const content = typeof r.content === 'string' ? r.content : '';
        return { label, content };
      })
      .filter((r) => allowedLabels.has(r.label) && r.content.trim().length > 0);

    // 尽量保证三种标签都存在；缺了就直接报错，前端会显示错误而不是“猜”
    const needed = ['克制版', '幽默版', '高情商版'] as const;
    const byLabel = new Map(repliesParsed.map((r) => [r.label, r.content]));
    const missing = needed.filter((lab) => !byLabel.get(lab)?.trim());
    if (missing.length > 0) {
      return Response.json(
        { error: `Model output missing replies for: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const finalReplies = needed.map((lab) => ({
      label: lab,
      content: byLabel.get(lab) as string,
    }));

    return Response.json({
      analysis: p.analysis,
      replies: finalReplies,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get reply response.';
    console.error('Reply API error:', error);
    return Response.json({ error: message }, { status: 500 });
  }
}

