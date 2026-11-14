import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Download,
  Loader2,
  Mic,
  Send,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { SessionStatus, TranscriptEntry } from '../types/voice';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  status: SessionStatus;
  isSendingText: boolean;
  isPreviewingVoice: boolean;
  onSendText: (text: string) => Promise<void> | void;
  onSpeakText: (text: string) => Promise<void> | void;
  onClear: () => void;
  onStartVoice: () => void;
}

export function TranscriptPanel({
  transcript,
  status,
  isSendingText,
  isPreviewingVoice,
  onSendText,
  onSpeakText,
  onClear,
  onStartVoice,
}: TranscriptPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSendingText) return;
    setDraft('');
    await onSendText(trimmed);
  };

  const handleExport = () => {
    if (transcript.length === 0) return;
    const lines = transcript.map(
      (entry) =>
        `[${entry.timestamp}] ${entry.role === 'user' ? 'You' : 'Vani'}: ${entry.text}`
    );
    const blob = new Blob([lines.join('\n\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vani-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLiveConnected =
    status === 'listening' || status === 'speaking' || status === 'paused';

  return (
    <section
      aria-label="Live conversation transcript"
      className="flex flex-col h-[580px] lg:h-[680px] bg-[#131822] border border-white/[0.08] rounded-xl overflow-hidden"
    >
      {/* Transcript Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="text-sm font-semibold text-[#F4F6F9] whitespace-nowrap">
            Conversation Transcript
          </h2>
          <span className="text-xs font-mono text-[#64748B] whitespace-nowrap">
            {transcript.length} {transcript.length === 1 ? 'turn' : 'turns'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={transcript.length === 0}
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F4F6F9] hover:bg-white/[0.05] rounded-md disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export</span>
          </button>
          <button
            type="button"
            disabled={transcript.length === 0}
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F4F6F9] hover:bg-white/[0.05] rounded-md disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Transcript Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 transcript-scroll">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
            <p className="text-base font-medium text-[#F4F6F9]">
              Ready for a real conversation
            </p>
            <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
              Speak naturally in Hindi, English, or mix both in Hinglish. You can
              interrupt anytime mid-sentence, or type a message below to hear
              Vani respond.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!isLiveConnected && (
                <button
                  type="button"
                  onClick={onStartVoice}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#E59A38] text-[#0B0E14] rounded-lg hover:bg-[#ECA84E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
                >
                  <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Start Voice Session</span>
                </button>
              )}
              <button
                type="button"
                disabled={isSendingText}
                onClick={() =>
                  onSendText(
                    'Namaste Vani! Kaise ho? Aaj hum Hinglish mein baat karein?'
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#F4F6F9] border border-white/[0.14] rounded-lg hover:bg-white/[0.05] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
              >
                <span>Try a Hinglish greeting</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {transcript.map((entry) => {
              const isUser = entry.role === 'user';
              return (
                <article key={entry.id} className="py-4 first:pt-1 last:pb-2">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          isUser ? 'text-[#CBD5E1]' : 'text-[#E59A38]'
                        }`}
                      >
                        {isUser ? 'You' : 'Vani'}
                      </span>
                      <span aria-hidden="true" className="text-[#475569]">
                        ·
                      </span>
                      <span className="font-mono text-[#64748B]">
                        {entry.timestamp}
                      </span>
                      {entry.isPartial && (
                        <>
                          <span aria-hidden="true" className="text-[#475569]">
                            ·
                          </span>
                          <span className="text-[#94A3B8]">
                            {isUser ? 'Listening' : 'Speaking'}
                          </span>
                        </>
                      )}
                    </div>

                    {!isUser && !entry.isPartial && entry.text.trim() && (
                      <button
                        type="button"
                        disabled={isPreviewingVoice}
                        onClick={() => onSpeakText(entry.text)}
                        aria-label="Replay spoken response"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#94A3B8] hover:text-[#E59A38] rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
                      >
                        <Volume2 className="w-3 h-3" aria-hidden="true" />
                        <span>Replay</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[15px] leading-relaxed text-[#F4F6F9] whitespace-pre-wrap">
                    {entry.text}
                  </p>
                </article>
              );
            })}

            {isSendingText && (
              <div className="py-4 flex items-center gap-2.5 text-sm text-[#94A3B8]">
                <Loader2 className="w-4 h-4 animate-spin text-[#E59A38]" aria-hidden="true" />
                <span>Vani is thinking and preparing her voice reply...</span>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Text / Hybrid Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 border-t border-white/[0.08] bg-[#0F141D]"
      >
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isLiveConnected
                ? 'Type to add context mid-conversation (Hindi, Hinglish, or English)...'
                : 'Type in Hindi, Hinglish, or English for an instant spoken reply...'
            }
            aria-label="Message Vani in Hindi, Hinglish, or English"
            className="flex-1 min-w-0 bg-[#131822] border border-white/[0.1] rounded-lg px-3.5 py-2.5 text-sm text-[#F4F6F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#E59A38]/70 transition-colors"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isSendingText}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#E59A38] text-[#0B0E14] rounded-lg hover:bg-[#ECA84E] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
          >
            {isSendingText ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Send</span>
          </button>
        </div>
      </form>
    </section>
  );
}
