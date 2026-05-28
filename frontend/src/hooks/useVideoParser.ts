import { useState, useCallback, useRef } from 'react';
import type { VideoInfo } from '@/types';
import { parseVideoUrl, downloadVideo } from '@/services/parseApi';

interface UseVideoParserReturn {
  url: string;
  setUrl: (url: string) => void;
  video: VideoInfo | null;
  loading: boolean;
  error: string | null;
  downloading: boolean;
  parse: () => Promise<void>;
  download: () => Promise<void>;
  reset: () => void;
}

export function useVideoParser(): UseVideoParserReturn {
  const [url, setUrl] = useState('');
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const parsingRef = useRef(false);

  const parse = useCallback(async () => {
    if (!url.trim() || parsingRef.current) return;
    parsingRef.current = true;
    setLoading(true);
    setError(null);
    setVideo(null);

    try {
      const data = await parseVideoUrl(url);
      setVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请检查链接是否正确');
    } finally {
      setLoading(false);
      parsingRef.current = false;
    }
  }, [url]);

  const download = useCallback(async () => {
    if (!video?.video_url) return;
    setDownloading(true);

    try {
      downloadVideo(video.video_url);
    } catch {
      window.open(video.video_url, '_blank', 'noopener,noreferrer');
    } finally {
      // 短暂延迟以给浏览器时间弹出下载
      setTimeout(() => setDownloading(false), 800);
    }
  }, [video]);

  const reset = useCallback(() => {
    setUrl('');
    setVideo(null);
    setError(null);
  }, []);

  return { url, setUrl, video, loading, error, downloading, parse, download, reset };
}
