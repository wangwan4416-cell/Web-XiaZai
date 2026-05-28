import { useState, useEffect, type FormEvent } from 'react';
import { Link, Loader2 } from 'lucide-react';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const platformBadge: Record<string, { label: string; color: string }> = {
  douyin: { label: '抖音', color: 'bg-platform-douyin text-white' },
  kuaishou: { label: '快手', color: 'bg-platform-kuaishou text-white' },
  bilibili: { label: 'B站', color: 'bg-platform-bilibili text-white' },
};

function detectPlatform(url: string): string | null {
  if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'douyin';
  if (/kuaishou\.com|gifshow\.com/i.test(url)) return 'kuaishou';
  if (/bilibili\.com|b23\.tv/i.test(url)) return 'bilibili';
  return null;
}

export default function UrlInput({ value, onChange, onSubmit, loading }: UrlInputProps) {
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform(value));
  }, [value]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit();
  };

  const badge = platform ? platformBadge[platform] : null;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex gap-3">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="粘贴视频分享链接..."
            disabled={loading}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-10 pr-24 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 transition-all"
          />
          {badge && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!value.trim() || loading}
          className="shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? '解析中' : '解析'}
        </button>
      </div>
    </form>
  );
}
