import { useState } from 'react';
import { Download, Loader2, ImageOff } from 'lucide-react';
import type { VideoInfo } from '@/types';

interface VideoCardProps {
  video: VideoInfo;
  onDownload: () => Promise<void>;
  downloading: boolean;
}

const platformLabel: Record<string, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  bilibili: 'B站',
};

const platformBorder: Record<string, string> = {
  douyin: 'border-platform-douyin/40',
  kuaishou: 'border-platform-kuaishou/40',
  bilibili: 'border-platform-bilibili/40',
};

export default function VideoCard({ video, onDownload, downloading }: VideoCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`animate-slide-up rounded-2xl border ${platformBorder[video.platform] || 'border-slate-800'} bg-slate-900/60 overflow-hidden`}>
      {/* Cover */}
      <div className="relative aspect-video bg-slate-800 overflow-hidden">
        {video.cover && !imgError ? (
          <img
            src={video.cover}
            alt={video.title}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-10 w-10 text-slate-600" />
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur px-2.5 py-1 text-xs font-medium text-white">
          {platformLabel[video.platform] || video.platform}
        </span>
      </div>

      {/* Info */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-medium text-white line-clamp-2 leading-snug">
            {video.title || '无标题'}
          </h3>
          {video.author && (
            <p className="mt-1.5 text-sm text-slate-400">@{video.author}</p>
          )}
        </div>

        <button
          onClick={onDownload}
          disabled={downloading || !video.video_url}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              下载中...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              下载无水印视频
            </>
          )}
        </button>
      </div>
    </div>
  );
}
