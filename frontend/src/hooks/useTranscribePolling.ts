import { useState, useCallback, useRef, useEffect } from 'react';
import type { TranscribeStatus } from '@/types';
import { createTranscribeTask, pollTranscribeTask } from '@/services/parseApi';

interface UseTranscribePollingReturn {
  status: TranscribeStatus | null;
  stage: string | null;
  text: string | null;
  transcribing: boolean;
  elapsed: number;
  startTranscribe: (videoUrl: string) => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL = 2000;
const MAX_POLLS = 150; // 5 minutes at 2s intervals

export function useTranscribePolling(): UseTranscribePollingReturn {
  const [status, setStatus] = useState<TranscribeStatus | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const stopElapsed = useCallback(() => {
    if (elapsedTimer.current) {
      clearInterval(elapsedTimer.current);
      elapsedTimer.current = null;
    }
  }, []);

  const startElapsed = useCallback(() => {
    stopElapsed();
    setElapsed(0);
    elapsedTimer.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [stopElapsed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearPoll();
      stopElapsed();
    };
  }, [clearPoll, stopElapsed]);

  const poll = useCallback(
    async (taskId: string, count: number) => {
      if (count >= MAX_POLLS) {
        setStatus('failed');
        setTranscribing(false);
        stopElapsed();
        return;
      }

      try {
        const data = await pollTranscribeTask(taskId);

        if (data.code === 404) {
          setStatus('failed');
          setTranscribing(false);
          stopElapsed();
          return;
        }

        if (data.status === 'done' && data.data) {
          setStatus('done');
          setText(data.data.text);
          setTranscribing(false);
          stopElapsed();
          return;
        }

        if (data.status === 'failed') {
          setStatus('failed');
          setTranscribing(false);
          stopElapsed();
          return;
        }

        setStatus(data.status || 'pending');
        setStage(data.stage || null);

        pollTimer.current = setTimeout(() => poll(taskId, count + 1), POLL_INTERVAL);
      } catch {
        pollTimer.current = setTimeout(() => poll(taskId, count + 1), POLL_INTERVAL);
      }
    },
    [stopElapsed],
  );

  const startTranscribe = useCallback(
    async (videoUrl: string) => {
      clearPoll();
      stopElapsed();
      setStatus('pending');
      setStage(null);
      setText(null);
      setTranscribing(true);

      try {
        const taskId = await createTranscribeTask(videoUrl);
        startElapsed();
        poll(taskId, 0);
      } catch {
        setStatus('failed');
        setTranscribing(false);
      }
    },
    [poll, clearPoll, startElapsed, stopElapsed],
  );

  const reset = useCallback(() => {
    clearPoll();
    stopElapsed();
    setStatus(null);
    setStage(null);
    setText(null);
    setTranscribing(false);
    setElapsed(0);
  }, [clearPoll, stopElapsed]);

  return { status, stage, text, transcribing, elapsed, startTranscribe, reset };
}
