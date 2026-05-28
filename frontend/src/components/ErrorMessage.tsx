import { AlertCircle, WifiOff, Clock, ServerCrash } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

const errorTypes = [
  { keys: ['超时', 'timeout'], icon: Clock, hint: '上游服务响应超时，可稍后重试' },
  { keys: ['网络', 'fetch', 'NetworkError'], icon: WifiOff, hint: '请检查网络连接后重试' },
  { keys: ['繁忙', '502', '500'], icon: ServerCrash, hint: '服务器繁忙，请稍后重试' },
];

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  const matched = errorTypes.find((t) => t.keys.some((k) => message.includes(k)));
  const Icon = matched?.icon || AlertCircle;
  const hint = matched?.hint;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-900/40 bg-red-950/30 px-6 py-8 text-center animate-fade-in">
      <Icon className="h-8 w-8 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
      {hint && <p className="text-xs text-slate-500 -mt-1">{hint}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-600/30 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
}
