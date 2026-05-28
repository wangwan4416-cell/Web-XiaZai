interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 animate-fade-in">
      <div
        className={`${sizeMap[size]} rounded-full border-slate-700 border-t-indigo-400 animate-spin`}
      />
      {message && (
        <p className="text-sm text-slate-400">{message}</p>
      )}
    </div>
  );
}
