'use client';

import React, { useMemo, useState } from 'react';

type Mode = 'interpret' | 'reply' | 'optimize';

type InterpretResponse = {
  surface_meaning: string;
  subtext: string;
  emotion_score: number;
  risk_level: 'low' | 'medium' | 'high';
  suggestion: string;
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

export default function Home() {
  const [mode, setMode] = useState<Mode>('interpret');

  const [otherMessage, setOtherMessage] = useState('');
  const [context, setContext] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // interpret 结果
  const [surfaceMeaning, setSurfaceMeaning] = useState<string>('');
  const [subtext, setSubtext] = useState<string>('');
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<InterpretResponse['risk_level'] | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');

  // reply 结果
  const [replyAnalysis, setReplyAnalysis] = useState<string>('');
  const [replies, setReplies] = useState<Array<{ label: string; content: string }>>([]);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const canRun = useMemo(() => otherMessage.trim().length > 0 && !loading, [otherMessage, loading]);

  async function run() {
    setError(null);
    setLoading(true);

    try {
      const text = otherMessage.trim();
      const bg = context.trim();

      // 先解释（分析 + 潜台词/情绪/风险/建议）
      const interpretRes = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: bg }),
      });

      if (!interpretRes.ok) {
        const t = await interpretRes.text().catch(() => '');
        throw new Error(`Interpret 请求失败：${interpretRes.status} ${t}`.trim());
      }

      const interpretJson = (await interpretRes.json()) as Partial<InterpretResponse>;

      // 严格按字段结构展示；若后端字段缺失则使用兜底空值（不猜内容）
      setSurfaceMeaning(safeString(interpretJson.surface_meaning));
      setSubtext(safeString(interpretJson.subtext));
      setEmotionScore(safeNumber(interpretJson.emotion_score));
      setRiskLevel(safeRisk(interpretJson.risk_level));
      setSuggestion(safeString(interpretJson.suggestion));

      // reply/optimize 需要回复建议
      if (mode === 'reply' || mode === 'optimize') {
        const replyRes = await fetch('/api/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, context: bg }),
        });

        if (!replyRes.ok) {
          const t = await replyRes.text().catch(() => '');
          throw new Error(`Reply 请求失败：${replyRes.status} ${t}`.trim());
        }

        const replyJson = (await replyRes.json()) as Partial<ReplyResponse>;
        setReplyAnalysis(safeString(replyJson.analysis));

        const repsRaw: unknown[] = Array.isArray(replyJson.replies) ? replyJson.replies as unknown[] : [];
        const repsParsed = repsRaw
          .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
          .map((r) => ({
            label: safeString(r.label),
            content: safeString(r.content),
          }))
          .slice(0, 3);

        setReplies(repsParsed);
      } else {
        // interpret 模式不更新 reply 内容
        setReplyAnalysis('');
        setReplies([]);
      }

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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* 顶部标题（产品级文案） */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="font-semibold">关系沟通AI工具</span>
            <span className="text-zinc-500 dark:text-zinc-400">分析 + 决策 + 回复</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            一句话看懂潜台词，生成可落地沟通方案
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-300">
            输入对方消息与背景，选择模式后生成：分析结果、策略建议、以及 3 种风格的回复（带复制按钮）。
          </p>
        </div>

        {/* 输入区 */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                对方消息
              </label>
              <textarea
                value={otherMessage}
                onChange={(e) => setOtherMessage(e.target.value)}
                placeholder="粘贴对方发来的原话（尽量原文）..."
                className="min-h-[160px] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-300 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                建议包含情境、语气、关键措辞。
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                背景（关系/历史/顾虑）
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="例如：关系阶段、发生过的关键事件、对方可能在意什么..."
                className="min-h-[160px] w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-300 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                背景可提升建议的匹配度。
              </p>
            </div>
          </div>

          {/* 模式选择 */}
          <div className="mt-6">
            <div className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              模式选择
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'interpret' as const, label: '分析', desc: '判断潜台词 / 情绪 / 风险' },
                { id: 'reply' as const, label: '回复', desc: '生成可复制回复（3 种风格）' },
                { id: 'optimize' as const, label: '优化', desc: '在回复基础上给出更稳的表达' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={[
                    'rounded-xl border px-4 py-3 text-left transition',
                    'dark:border-zinc-800',
                    mode === m.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-200 dark:bg-zinc-50 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-50',
                  ].join(' ')}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div className="mt-1 text-xs opacity-80">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 执行按钮 */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className={[
                'rounded-xl px-5 py-3 text-sm font-semibold transition',
                'border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60 disabled:hover:bg-zinc-900',
                'dark:border-zinc-200 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white',
              ].join(' ')}
            >
              {loading ? '生成中…' : mode === 'interpret' ? '开始分析' : mode === 'reply' ? '生成回复' : '开始优化'}
            </button>

            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              分析：`POST /api/interpret`；回复：`POST /api/reply`
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* 结果展示区（卡片式） */}
        <div className="mt-6">
          <div className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            结果展示
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* 分析结果卡片 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
              <div className="text-base font-semibold">分析结果</div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    表层含义
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {surfaceMeaning || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    潜台词
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {subtext || '—'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      情绪分数
                    </div>
                    <div className="mt-1 text-sm leading-relaxed">
                      {emotionScore === null ? '—' : emotionScore}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      风险等级
                    </div>
                    <div className="mt-1 text-sm leading-relaxed">
                      {riskLevel || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 策略建议卡片 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
              <div className="text-base font-semibold">策略建议</div>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
                    推进
                  </div>
                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {suggestion || '—'}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
                    保持
                  </div>
                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {suggestion || '—'}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
                    收
                  </div>
                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {suggestion || '—'}
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  说明：`/api/interpret` 仅返回一个 `suggestion` 字段，因此以上三个分项展示同一内容。
                </p>

                {mode !== 'interpret' && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
                      回复补充分析
                    </div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                      {replyAnalysis || '—'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 回复建议卡片 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
              <div className="text-base font-semibold">回复建议</div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                每条回复都带 Copy 按钮
              </div>

              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => {
                  const item = replies[idx];
                  const label = item?.label ?? '';
                  const content = item?.content ?? '';
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
                          {label || `回复 ${idx + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(content, idx)}
                          disabled={!content.trim()}
                          className={[
                            'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                            'dark:border-zinc-700',
                            content.trim()
                              ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600',
                          ].join(' ')}
                        >
                          {copiedIndex === idx ? '已复制' : 'Copy'}
                        </button>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900 dark:text-zinc-50">
                        {content.trim() ? content : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
