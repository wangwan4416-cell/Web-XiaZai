export interface VideoInfo {
  platform: 'douyin' | 'kuaishou' | 'bilibili';
  title: string;
  author: string;
  cover: string;
  video_url: string;
}

export interface ParseResponse {
  code: number;
  data?: VideoInfo;
  msg?: string;
}

export type TranscribeStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface TranscribeResponse {
  code: number;
  task_id?: string;
  status?: TranscribeStatus;
  stage?: 'extracting_audio' | 'transcribing' | 'waking_up';
  progress?: string;
  data?: { text: string };
  msg?: string;
}

export interface AppState {
  video: VideoInfo | null;
  loading: boolean;
  error: string | null;
  transcriptStatus: TranscribeStatus | null;
  transcriptStage: string | null;
  transcriptText: string | null;
  taskId: string | null;
}
