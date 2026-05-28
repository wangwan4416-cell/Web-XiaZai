import UrlInput from '@/components/UrlInput';
import VideoCard from '@/components/VideoCard';
import TranscriptPanel from '@/components/TranscriptPanel';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useVideoParser } from '@/hooks/useVideoParser';
import { useTranscribePolling } from '@/hooks/useTranscribePolling';

function App() {
  const { url, setUrl, video, loading, error, downloading, parse, download, reset } =
    useVideoParser();
  const { status, stage, text, transcribing, elapsed, startTranscribe, reset: resetTranscribe } =
    useTranscribePolling();

  const handleTranscribe = () => {
    if (video?.video_url) {
      startTranscribe(video.video_url);
    }
  };

  const handleReset = () => {
    reset();
    resetTranscribe();
  };

  const handleParse = () => {
    resetTranscribe();
    parse();
  };

  return (
    <div className="flex min-h-svh flex-col items-center px-4 py-12">
      {/* Background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight sm:text-4xl">
          视频解析下载
        </h1>
        <p className="mt-2 text-slate-400">
          粘贴链接，一键下载无水印视频与文案
        </p>
      </header>

      <main className="w-full max-w-xl flex-1">
        {/* URL Input */}
        <UrlInput
          value={url}
          onChange={setUrl}
          onSubmit={handleParse}
          loading={loading}
        />

        {/* Loading */}
        {loading && <LoadingSpinner message="正在解析视频信息..." />}

        {/* Error */}
        {error && <ErrorMessage message={error} onRetry={parse} />}

        {/* Video Card */}
        {video && (
          <div className="mt-6 space-y-4 animate-fade-in">
            <VideoCard
              video={video}
              onDownload={download}
              downloading={downloading}
            />

            {/* Transcript Panel */}
            <TranscriptPanel
              status={status}
              stage={stage}
              text={text}
              elapsed={elapsed}
              onTranscribe={handleTranscribe}
              transcribing={transcribing}
            />

            {/* New Parse Button */}
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-colors"
            >
              解析新链接
            </button>
          </div>
        )}

        {/* Empty state */}
        {!video && !loading && !error && (
          <div className="mt-12 text-center animate-fade-in">
            <p className="text-sm text-slate-600">
              支持抖音、快手、B站（bilibili）视频链接
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto pt-12 text-center text-xs text-slate-600">
        <p>仅供学习使用，请遵守平台服务条款</p>
      </footer>
    </div>
  );
}

export default App;
