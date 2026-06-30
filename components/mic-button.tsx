'use client';

import { Loader2, Mic } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pick a recording mime type the browser supports. Whisper accepts all of these;
 * we just need MediaRecorder to actually produce one.
 */
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm', 'audio/ogg', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function extForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'm4a';
  return 'webm';
}

type Status = 'idle' | 'recording' | 'transcribing';

/**
 * Animated equalizer bars — drop into a text box to show that voice capture is
 * live. Purely decorative (aria-hidden); render it only while recording.
 */
export function VoiceWave({ className = '' }: { className?: string }) {
  // Staggered delays give the bars a travelling-wave look.
  const delays = ['0s', '0.15s', '0.3s', '0.45s', '0.3s', '0.15s', '0s'];
  return (
    <span className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {delays.map((d, i) => (
        <span
          key={i}
          className="h-4 w-[3px] origin-center animate-wave rounded-full bg-indigo-500"
          style={{ animationDelay: d }}
        />
      ))}
      <span className="ml-2 text-sm font-medium text-indigo-600">Listening…</span>
    </span>
  );
}

/**
 * Mic button: records a short clip in the browser and transcribes it via
 * /api/transcribe (Groq Whisper). Unlike the browser's built-in speech API this
 * works in every modern browser and doesn't depend on Google's speech service.
 *
 * Click to start recording, click again to stop — the clip is then transcribed
 * and the text handed to `onTranscript` for the parent to append.
 */
export function MicButton({
  onTranscript,
  onError,
  onRecordingChange,
  disabled,
  className = '',
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  /** Fired when recording starts/stops, so the composer can show a wave. */
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onRecordingChangeRef = useRef(onRecordingChange);
  onRecordingChangeRef.current = onRecordingChange;

  // Let the parent mirror the recording state (for the in-textbox wave).
  useEffect(() => {
    onRecordingChangeRef.current?.(status === 'recording');
  }, [status]);

  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined',
    );
    // Release the mic if the component unmounts mid-recording.
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const transcribe = useCallback(async (blob: Blob, mime: string) => {
    setStatus('transcribing');
    try {
      const form = new FormData();
      form.append('audio', blob, `recording.${extForMime(mime)}`);
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      const text = (data.text ?? '').trim();
      if (text) onTranscriptRef.current(text);
      else onErrorRef.current?.("Didn't catch that — try speaking again.");
    } catch (err) {
      onErrorRef.current?.(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setStatus('idle');
    }
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size > 0) void transcribe(blob, type);
        else setStatus('idle');
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (err) {
      // getUserMedia rejects when the user denies the mic or none exists.
      const name = err instanceof DOMException ? err.name : '';
      onErrorRef.current?.(
        name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow it in your browser site settings, then try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found. Plug one in or check your input device.'
            : 'Could not start recording.',
      );
      setStatus('idle');
    }
  }, [transcribe]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const onClick = useCallback(() => {
    if (status === 'recording') stop();
    else if (status === 'idle') void start();
  }, [status, start, stop]);

  if (!supported) return null;

  const recording = status === 'recording';
  const busy = status === 'transcribing';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={recording ? 'Stop recording' : 'Dictate with your voice'}
      aria-pressed={recording}
      title={recording ? 'Recording… click to stop' : busy ? 'Transcribing…' : 'Speak to type'}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${
        recording
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
      } ${className}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
