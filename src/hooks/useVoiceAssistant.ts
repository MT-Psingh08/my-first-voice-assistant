import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LanguageMode,
  type SessionStatus,
  type TonePreset,
  type TranscriptEntry,
  type VoiceName,
} from '../types/voice';
import {
  base64ToFloat32,
  computeRmsLevel,
  float32ToInt16Base64,
  formatClockTime,
} from '../utils/audio';

interface UseVoiceAssistantOptions {
  voice: VoiceName;
  language: LanguageMode;
  tone: TonePreset;
}

export function useVoiceAssistant({
  voice,
  language,
  tone,
}: UseVoiceAssistantOptions) {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const inputLevelRef = useRef<number>(0);
  const isMicMutedRef = useRef<boolean>(false);
  const statusRef = useRef<SessionStatus>('idle');
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUserEntryIdRef = useRef<string | null>(null);
  const currentAssistantEntryIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Session timer
  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      return;
    }
    const timer = window.setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const stopPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, []);

  const ensureOutputAudioContext = useCallback(() => {
    if (!outputCtxRef.current || outputCtxRef.current.state === 'closed') {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      analyser.connect(ctx.destination);
      outputCtxRef.current = ctx;
      outputAnalyserRef.current = analyser;
    }
    if (outputCtxRef.current.state === 'suspended') {
      void outputCtxRef.current.resume();
    }
    return outputCtxRef.current;
  }, []);

  const schedulePcmChunk = useCallback(
    (base64Pcm: string) => {
      const ctx = ensureOutputAudioContext();
      const analyser = outputAnalyserRef.current;
      const samples = base64ToFloat32(base64Pcm);
      if (samples.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
      audioBuffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      if (analyser) {
        source.connect(analyser);
      } else {
        source.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.025;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      activeSourcesRef.current.add(source);
      setStatus('speaking');

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (
          activeSourcesRef.current.size === 0 &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          setStatus(isMicMutedRef.current ? 'paused' : 'listening');
        }
      };
    },
    [ensureOutputAudioContext]
  );

  const appendTranscriptDelta = useCallback(
    (role: 'user' | 'assistant', delta: string) => {
      const trimmed = delta;
      if (!trimmed) return;

      const activeIdRef =
        role === 'user' ? currentUserEntryIdRef : currentAssistantEntryIdRef;
      const otherIdRef =
        role === 'user' ? currentAssistantEntryIdRef : currentUserEntryIdRef;

      // Finalize the opposite speaker's partial bubble when the turn switches
      if (otherIdRef.current) {
        const finalizeId = otherIdRef.current;
        otherIdRef.current = null;
        setTranscript((prev) =>
          prev.map((item) =>
            item.id === finalizeId ? { ...item, isPartial: false } : item
          )
        );
      }

      setTranscript((prev) => {
        const existingId = activeIdRef.current;
        if (existingId) {
          return prev.map((item) =>
            item.id === existingId
              ? { ...item, text: item.text + trimmed, isPartial: true }
              : item
          );
        }
        const newId = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        activeIdRef.current = newId;
        return [
          ...prev,
          {
            id: newId,
            role,
            text: trimmed.trimStart(),
            timestamp: formatClockTime(),
            isPartial: true,
            source: 'live',
          },
        ];
      });
    },
    []
  );

  const finalizeActiveTurns = useCallback(() => {
    currentUserEntryIdRef.current = null;
    currentAssistantEntryIdRef.current = null;
    setTranscript((prev) =>
      prev.map((item) =>
        item.isPartial ? { ...item, isPartial: false } : item
      )
    );
  }, []);

  const teardownAudioAndSocket = useCallback(() => {
    stopPlaybackQueue();
    inputLevelRef.current = 0;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (inputCtxRef.current && inputCtxRef.current.state !== 'closed') {
      void inputCtxRef.current.close();
      inputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
  }, [stopPlaybackQueue]);

  const startSession = useCallback(async () => {
    if (statusRef.current === 'connecting' || statusRef.current === 'listening' || statusRef.current === 'speaking') {
      return;
    }

    setErrorMessage(null);
    setStatus('connecting');
    setSessionSeconds(0);
    setIsMicMuted(false);
    isMicMutedRef.current = false;

    try {
      ensureOutputAudioContext();

      let stream: MediaStream | null = null;
      let inputCtx: AudioContext | null = null;

      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
          inputCtx = new AudioContext({ sampleRate: 16000 });
          inputCtxRef.current = inputCtx;
          if (inputCtx.state === 'suspended') {
            await inputCtx.resume();
          }
        } catch {
          setIsMicMuted(true);
          isMicMutedRef.current = true;
          setErrorMessage(
            'Microphone access is unavailable. You can still hear Vani speak and reply using the message box or starters.'
          );
        }
      } else {
        setIsMicMuted(true);
        isMicMutedRef.current = true;
        setErrorMessage(
          'Microphone capture is unsupported here. You can still hear Vani speak and reply using the message box.'
        );
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            voice,
            language,
            tone,
            autoGreet: true,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: string;
            text?: string;
            message?: string;
          };

          if (msg.type === 'ready') {
            setStatus(isMicMutedRef.current ? 'paused' : 'listening');

            if (stream && inputCtx) {
              const source = inputCtx.createMediaStreamSource(stream);
              sourceNodeRef.current = source;

              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (audioEvent) => {
                const samples = audioEvent.inputBuffer.getChannelData(0);
                if (isMicMutedRef.current) {
                  inputLevelRef.current = 0;
                  return;
                }
                inputLevelRef.current = computeRmsLevel(samples);
                if (ws.readyState === WebSocket.OPEN) {
                  const base64 = float32ToInt16Base64(samples);
                  ws.send(JSON.stringify({ type: 'audio', data: base64 }));
                }
              };

              source.connect(processor);
              processor.connect(inputCtx.destination);
            }
            return;
          }

          if (msg.type === 'audio' && msg.data) {
            schedulePcmChunk(msg.data);
            return;
          }

          if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscriptDelta('user', msg.text);
            return;
          }

          if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscriptDelta('assistant', msg.text);
            return;
          }

          if (msg.type === 'turnComplete') {
            finalizeActiveTurns();
            if (activeSourcesRef.current.size === 0) {
              setStatus(isMicMutedRef.current ? 'paused' : 'listening');
            }
            return;
          }

          if (msg.type === 'interrupted') {
            stopPlaybackQueue();
            finalizeActiveTurns();
            setStatus(isMicMutedRef.current ? 'paused' : 'listening');
            return;
          }

          if (msg.type === 'error') {
            setErrorMessage(
              msg.message || 'Voice session encountered a connection error.'
            );
            teardownAudioAndSocket();
            setStatus('error');
            return;
          }

          if (msg.type === 'closed') {
            finalizeActiveTurns();
            teardownAudioAndSocket();
            setStatus('idle');
          }
        } catch (err) {
          console.error('Failed to handle server WS message:', err);
        }
      };

      ws.onerror = () => {
        setErrorMessage('Unable to maintain real-time WebSocket connection.');
        teardownAudioAndSocket();
        setStatus('error');
      };

      ws.onclose = () => {
        if (
          statusRef.current !== 'idle' &&
          statusRef.current !== 'error'
        ) {
          finalizeActiveTurns();
          teardownAudioAndSocket();
          setStatus('idle');
        }
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not access microphone. Please check browser permissions.';
      setErrorMessage(msg);
      teardownAudioAndSocket();
      setStatus('error');
    }
  }, [
    appendTranscriptDelta,
    ensureOutputAudioContext,
    finalizeActiveTurns,
    language,
    schedulePcmChunk,
    stopPlaybackQueue,
    teardownAudioAndSocket,
    tone,
    voice,
  ]);

  const endSession = useCallback(() => {
    finalizeActiveTurns();
    teardownAudioAndSocket();
    setStatus('idle');
    setErrorMessage(null);
  }, [finalizeActiveTurns, teardownAudioAndSocket]);

  const toggleMicMute = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      isMicMutedRef.current = next;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (activeSourcesRef.current.size === 0) {
          setStatus(next ? 'paused' : 'listening');
        }
      }
      return next;
    });
  }, []);

  const interruptAssistant = useCallback(() => {
    stopPlaybackQueue();
    finalizeActiveTurns();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setStatus(isMicMutedRef.current ? 'paused' : 'listening');
    }
  }, [finalizeActiveTurns, stopPlaybackQueue]);

  const playWavBase64 = useCallback(
    async (base64Wav: string) => {
      stopPlaybackQueue();
      const ctx = ensureOutputAudioContext();
      const binary = atob(base64Wav);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      activeSourcesRef.current.add(source);
      const prevStatus = statusRef.current;
      if (prevStatus === 'idle' || prevStatus === 'error') {
        setStatus('speaking');
      }

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            setStatus(isMicMutedRef.current ? 'paused' : 'listening');
          } else {
            setStatus('idle');
          }
        }
      };
      source.start();
    },
    [ensureOutputAudioContext, stopPlaybackQueue]
  );

  const sendTextMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      setErrorMessage(null);

      // If live WebSocket session is active, inject the text turn directly into Live API!
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        finalizeActiveTurns();
        setTranscript((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: 'user',
            text,
            timestamp: formatClockTime(),
            source: 'text',
          },
        ]);
        wsRef.current.send(JSON.stringify({ type: 'text', text }));
        return;
      }

      // Otherwise use REST /api/voice-turn (Gemini 4 Hydrogen + Gemini 3.8 Flash Lite TTS)
      setIsSendingText(true);
      const userEntry: TranscriptEntry = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        timestamp: formatClockTime(),
        source: 'text',
      };
      setTranscript((prev) => [...prev, userEntry]);

      try {
        const response = await fetch('/api/voice-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: transcriptRef.current.slice(-10).map((t) => ({
              role: t.role,
              text: t.text,
            })),
            language,
            tone,
            voice,
          }),
        });

        const data = (await response.json()) as {
          text?: string;
          audioBase64?: string | null;
          error?: string;
        };

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to get response from Vani.');
        }

        if (data.text) {
          setTranscript((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              text: data.text!,
              timestamp: formatClockTime(),
              source: 'text',
            },
          ]);
        }

        if (data.audioBase64) {
          await playWavBase64(data.audioBase64);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to send message.'
        );
      } finally {
        setIsSendingText(false);
      }
    },
    [finalizeActiveTurns, language, playWavBase64, tone, voice]
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setIsPreviewingVoice(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, language, tone }),
        });
        const data = (await res.json()) as {
          audioBase64?: string;
          error?: string;
        };
        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'Could not synthesize voice sample.');
        }
        await playWavBase64(data.audioBase64);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Speech playback failed.'
        );
      } finally {
        setIsPreviewingVoice(false);
      }
    },
    [language, playWavBase64, tone, voice]
  );

  const clearTranscript = useCallback(() => {
    currentUserEntryIdRef.current = null;
    currentAssistantEntryIdRef.current = null;
    setTranscript([]);
  }, []);

  useEffect(() => {
    return () => {
      teardownAudioAndSocket();
      if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
        void outputCtxRef.current.close();
      }
    };
  }, [teardownAudioAndSocket]);

  return {
    status,
    isMicMuted,
    isSendingText,
    isPreviewingVoice,
    errorMessage,
    transcript,
    sessionSeconds,
    inputLevelRef,
    outputAnalyserRef,
    startSession,
    endSession,
    toggleMicMute,
    interruptAssistant,
    sendTextMessage,
    speakText,
    clearTranscript,
    dismissError: () => setErrorMessage(null),
  };
}
