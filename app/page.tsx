'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useMemo, useRef, useState } from 'react';

type InterpretResponse = {
  surface_meaning: string;
  subtext: string;
  emotion_score: number;
  risk_level: 'low' | 'medium' | 'high';
  suggestion_push: string;
  suggestion_keep: string;
  suggestion_withdraw: string;
};

type ReplyResponse = {
  analysis: string;
  replies: Array<{
    label: string;
    content: string;
  }>;
};

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function safeRisk(v: unknown): InterpretResponse['risk_level'] | null {
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return null;
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function formatRiskLevel(level: InterpretResponse['risk_level'] | null): string {
  if (!level) return '—';
  const map: Record<InterpretResponse['risk_level'], string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return map[level];
}

function riskGuidance(level: InterpretResponse['risk_level'] | null): string {
  if (!level) return '';
  if (level === 'low') return '信号相对温和，可按你的节奏自然回应。';
  if (level === 'medium') return '存在误解或情绪升温可能，注意措辞与节奏，避免硬碰硬。';
  return '张力偏高，优先降温与留白，减少追问与指责式表达。';
}

export default function Home() {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<Array<{ dataUrl: string; name: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [surfaceMeaning, setSurfaceMeaning] = useState<string>('');
  const [subtext, setSubtext] = useState<string>('');
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<InterpretResponse['risk_level'] | null>(null);
  const [suggestionPush, setSuggestionPush] = useState<string>('');
  const [suggestionKeep, setSuggestionKeep] = useState<string>('');
  const [suggestionWithdraw, setSuggestionWithdraw] = useState<string>('');

  const [replyAnalysis, setReplyAnalysis] = useState<string>('');
  const [replies, setReplies] = useState<Array<{ label: string; content: string }>>([]);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const canRun = useMemo(() => {
    const hasText = input.trim().length > 0;
    const hasImages = images.length > 0;
    return (hasText || hasImages) && !loading;
  }, [input, images.length, loading]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') resolve(result);
        else reject(new Error('Failed to read file as data URL.'));
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  async function addImages(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const items = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        dataUrl: await readFileAsDataUrl(f),
      }))
    );
    setImages((prev) => [...prev, ...items]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function run() {
    setError(null);
    setLoading(true);

    try {
      const text = input.trim();
      const context = '';
      const image_data_urls = images.length > 0 ? images.map((i) => i.dataUrl) : undefined;

      const interpretBody: Record<string, unknown> = { text, context };
      if (image_data_urls) interpretBody.image_data_urls = image_data_urls;
      const interpretRes = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interpretBody),
      });

      if (!interpretRes.ok) {
        const t = await interpretRes.text().catch(() => '');
        throw new Error(`Interpret 请求失败：${interpretRes.status} ${t}`.trim());
      }

      const interpretJson = (await interpretRes.json()) as Partial<InterpretResponse>;
      setSurfaceMeaning(safeString(interpretJson.surface_meaning));
      setSubtext(safeString(interpretJson.subtext));
      setEmotionScore(safeNumber(interpretJson.emotion_score));
      setRiskLevel(safeRisk(interpretJson.risk_level));
      setSuggestionPush(safeString(interpretJson.suggestion_push));
      setSuggestionKeep(safeString(interpretJson.suggestion_keep));
      setSuggestionWithdraw(safeString(interpretJson.suggestion_withdraw));

      const replyBody: Record<string, unknown> = { text, context };
      if (image_data_urls) replyBody.image_data_urls = image_data_urls;
      const replyRes = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyBody),
      });

      if (!replyRes.ok) {
        const t = await replyRes.text().catch(() => '');
        throw new Error(`Reply 请求失败：${replyRes.status} ${t}`.trim());
      }

      const replyJson = (await replyRes.json()) as Partial<ReplyResponse>;
      setReplyAnalysis(safeString(replyJson.analysis));

      const repsRaw: unknown[] = Array.isArray(replyJson.replies) ? (replyJson.replies as unknown[]) : [];
      const repsParsed = repsRaw
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => ({
          label: safeString(r.label),
          content: safeString(r.content),
        }))
        .slice(0, 3);
      setReplies(repsParsed);

      setCopiedIndex(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '发生错误，请稍后再试。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, idx: number) {
    try {
      if (!text.trim()) return;
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      window.setTimeout(() => setCopiedIndex(null), 1200);
    } catch {
      setError('复制失败：你的浏览器可能不允许剪贴板操作。');
    }
  }

  const cardClass =
    'rounded-xl border border-zinc-200/80 bg-white px-6 py-6 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]';
  const sectionTitle = 'text-xs font-medium uppercase tracking-[0.12em] text-zinc-500';
  const bodyText = 'mt-3 text-[15px] leading-relaxed text-zinc-800';

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 antialiased">
      <div className="mx-auto max-w-[640px] px-5 py-14 md:py-20">
        <header className="mb-10 border-b border-zinc-200/80 pb-8">
          <p className={sectionTitle}>关系沟通</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 md:text-[1.65rem]">
            读懂对方，再回复
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
            粘贴对方的话或上传截图，一键生成解读、回复与策略。
          </p>
        </header>

        {/* 单一输入 + 提交 */}
        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入对方发来的内容，或补充你们的背景……"
            rows={6}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-shadow focus:border-zinc-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.05)]"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addImages(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                添加图片
              </button>
              {images.length > 0 && (
                <>
                  <span className="text-xs text-zinc-400">{images.length} 张</span>
                  <button
                    type="button"
                    onClick={() => setImages([])}
                    className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
                  >
                    清空
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '生成中…' : '生成'}
            </button>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={`${img.name}-${idx}`} className="group relative">
                  <img
                    src={img.dataUrl}
                    alt=""
                    className="h-14 w-14 rounded-lg border border-zinc-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>

        {/* 结果：四块 */}
        {(surfaceMeaning || subtext || replies.length > 0 || suggestionPush) && (
          <div className="mt-14 space-y-6">
            <p className={sectionTitle}>结果</p>

            {/* 1. 对方真实意思 */}
            <section className={cardClass}>
              <h2 className="text-base font-semibold text-zinc-950">对方真实意思</h2>
              <div className="mt-5 space-y-5 border-t border-zinc-100 pt-5">
                <div>
                  <p className="text-xs font-medium text-zinc-500">字面在说什么</p>
                  <p className={bodyText}>{surfaceMeaning || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">潜台词</p>
                  <p className={bodyText}>{subtext || '—'}</p>
                </div>
                {replyAnalysis.trim() ? (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">综合解读</p>
                    <p className={bodyText}>{replyAnalysis}</p>
                  </div>
                ) : null}
              </div>
            </section>

            {/* 2. 建议回复 · 三种风格 */}
            <section className={cardClass}>
              <h2 className="text-base font-semibold text-zinc-950">建议回复</h2>
              <p className="mt-1 text-xs text-zinc-500">三种风格，可单独复制</p>
              <div className="mt-5 space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => {
                  const item = replies[idx];
                  const label = item?.label ?? '';
                  const content = item?.content ?? '';
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-medium text-zinc-600">
                          {label || `风格 ${idx + 1}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(content, idx)}
                          disabled={!content.trim()}
                          className="shrink-0 text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40"
                        >
                          {copiedIndex === idx ? '已复制' : '复制'}
                        </button>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-zinc-800">
                        {content.trim() ? content : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. 风险提示 */}
            <section className={cardClass}>
              <h2 className="text-base font-semibold text-zinc-950">风险提示</h2>
              <div className="mt-5 flex flex-wrap gap-8 border-t border-zinc-100 pt-5">
                <div>
                  <p className="text-xs font-medium text-zinc-500">风险等级</p>
                  <p className="mt-1 text-lg font-medium text-zinc-950">{formatRiskLevel(riskLevel)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">情绪强度</p>
                  <p className="mt-1 text-lg font-medium text-zinc-950">
                    {emotionScore === null ? '—' : `${emotionScore} / 10`}
                  </p>
                </div>
              </div>
              {riskLevel ? (
                <p className="mt-4 text-sm leading-relaxed text-zinc-600">{riskGuidance(riskLevel)}</p>
              ) : null}
            </section>

            {/* 4. 下一步策略 */}
            <section className={cardClass}>
              <h2 className="text-base font-semibold text-zinc-950">下一步策略</h2>
              <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5">
                {[
                  { title: '推进', body: suggestionPush },
                  { title: '保持', body: suggestionKeep },
                  { title: '收', body: suggestionWithdraw },
                ].map((row) => (
                  <div key={row.title} className="border-l-2 border-zinc-900 pl-4">
                    <p className="text-xs font-semibold text-zinc-950">{row.title}</p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-700">
                      {row.body || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
