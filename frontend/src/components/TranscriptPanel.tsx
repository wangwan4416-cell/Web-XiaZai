import { useState } from 'react';
import { FileText, Copy, Check, Loader2, CircleCheck, Circle, ChevronRight } from 'lucide-react';
import type { TranscribeStatus } from '@/types';

interface TranscriptPanelProps {
  status: TranscribeStatus | null;
  stage: string | null;
  text: string | null;
  elapsed: number;
  onTranscribe: () => void;
  transcribing: boolean;
}

const stageMessages: Record<string, string> = {
  extracting_audio: '正在提取视频音频...',
  transcribing: '正在进行语音识别...',
};

const allStages = [
  { key: 'extracting_audio', label: '提取音频' },
  { key: 'transcribing', label: '语音识别' },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export default function TranscriptPanel({
  status,
  stage,
  text,
  elapsed,
  onTranscribe,
  transcribing,
}: TranscriptPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Idle: user hasn't started transcribe yet
  if (status === null) {
    return (
      <div className="mt-6 animate-fade-in rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <FileText className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-400">视频文案</h4>
        </div>
        <div className="p-5">
          <button
            onClick={onTranscribe}
            disabled={transcribing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 px-4 py-5 text-sm text-slate-400 hover:border-indigo-500/40 hover:text-indigo-300 transition-all disabled:opacity-50 group"
          >
            <FileText className="h-4 w-4 group-hover:text-indigo-400 transition-colors" />
            <span>提取视频文案</span>
            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>
    );
  }

  // Processing or Pending
  if (status === 'pending' || status === 'processing') {
    const msg = stage ? stageMessages[stage] || '处理中...' : '正在连接服务器...';
    const currentIdx = allStages.findIndex((s) => s.key === stage);

    return (
      <div className="mt-6 animate-fade-in rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          <h4 className="text-sm font-medium text-slate-300">视频文案提取中</h4>
          {elapsed > 0 && (
            <span className="ml-auto text-xs text-slate-600 tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          {/* Stage progress */}
          <div className="space-y-3">
            {allStages.map((s, i) => {
              const completed = i < currentIdx;
              const active = i === currentIdx;

              return (
                <div key={s.key} className="flex items-center gap-3">
                  {completed ? (
                    <CircleCheck className="h-4 w-4 text-green-400 shrink-0" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-700 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      completed
                        ? 'text-slate-400'
                        : active
                          ? 'text-slate-200'
                          : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Status message */}
          <div className="border-t border-slate-800/60 pt-3">
            <p className="text-xs text-slate-500">{msg}</p>
          </div>
        </div>
      </div>
    );
  }

  // Done
  if (status === 'done' && text) {
    return (
      <div className="mt-6 animate-slide-up rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <CircleCheck className="h-4 w-4 text-green-400" />
            视频文案
          </h4>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                复制
              </>
            )}
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {text}
          </p>
        </div>
        <div className="border-t border-slate-800 px-5 py-3">
          <button
            onClick={onTranscribe}
            disabled={transcribing}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors disabled:opacity-50"
          >
            重新提取文案
          </button>
        </div>
      </div>
    );
  }

  // Failed
  return (
    <div className="mt-6 animate-fade-in rounded-2xl border border-red-900/40 bg-red-950/20 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-red-900/20">
        <FileText className="h-4 w-4 text-red-400" />
        <h4 className="text-sm font-medium text-red-300">视频文案</h4>
      </div>
      <div className="p-5 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-red-300">文案提取失败，请重试</p>
        <button
          onClick={onTranscribe}
          className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-600/30 transition-colors"
        >
          重新提取
        </button>
      </div>
    </div>
  );
}
