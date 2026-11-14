import { useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { AcousticOrbCanvas } from './components/AcousticOrbCanvas';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VoiceControlsPanel } from './components/VoiceControlsPanel';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import {
  CONVERSATION_STARTERS,
  type LanguageMode,
  type SessionStatus,
  type TonePreset,
  type VoiceName,
} from './types/voice';

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getStatusDisplay(status: SessionStatus, isMicMuted: boolean): {
  label: string;
  toneClass: string;
} {
  switch (status) {
    case 'connecting':
      return { label: 'Connecting voice channel', toneClass: 'text-[#E59A38]' };
    case 'listening':
      return {
        label: isMicMuted ? 'Microphone muted' : 'Listening continuously',
        toneClass: 'text-[#F4F6F9]',
      };
    case 'speaking':
      return { label: 'Vani is speaking', toneClass: 'text-[#E59A38]' };
    case 'paused':
      return { label: 'Microphone muted', toneClass: 'text-[#94A3B8]' };
    case 'error':
      return { label: 'Connection interrupted', toneClass: 'text-[#F87171]' };
    default:
      return { label: 'Ready to talk', toneClass: 'text-[#94A3B8]' };
  }
}

export default function App() {
  const [language, setLanguage] = useState<LanguageMode>('auto');
  const [voice, setVoice] = useState<VoiceName>('Kore');
  const [tone, setTone] = useState<TonePreset>('warm');

  const {
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
    dismissError,
  } = useVoiceAssistant({ voice, language, tone });

  const isLiveActive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'speaking' ||
    status === 'paused';

  const statusInfo = getStatusDisplay(status, isMicMuted);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F4F6F9] flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-white/[0.08] bg-[#0B0E14]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#studio"
            className="font-display text-xl font-bold tracking-tight text-[#F4F6F9] whitespace-nowrap shrink-0"
          >
            Vani
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94A3B8]"
          >
            <a
              href="#studio"
              className="hover:text-[#F4F6F9] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Voice Studio
            </a>
            <a
              href="#voice-profile"
              className="hover:text-[#F4F6F9] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Voice Profile
            </a>
            <a
              href="#starters"
              className="hover:text-[#F4F6F9] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Conversation Starters
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {isLiveActive ? (
              <button
                type="button"
                onClick={endSession}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#1E2532] text-[#F4F6F9] border border-white/[0.14] rounded-lg hover:bg-[#273041] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
              >
                <PhoneOff className="w-3.5 h-3.5 text-[#F87171]" aria-hidden="true" />
                <span>End Session</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startSession()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#E59A38] text-[#0B0E14] rounded-lg hover:bg-[#ECA84E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
              >
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Start Conversation</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Studio Content */}
      <main id="studio" className="flex-1 max-w-[1280px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-12">
        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Stage: Acoustic Presence & Profile Controls */}
          <div className="lg:col-span-5 space-y-7">
            <div className="space-y-2.5">
              <h1
                className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#F4F6F9] leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                Natural voice conversations in Hindi, English, and Hinglish
              </h1>
              <p className="text-sm sm:text-[15px] text-[#94A3B8] leading-relaxed">
                Speak freely with realistic Indian English intonation, instant
                two-way turn taking, and effortless code-switching.
              </p>
            </div>

            {/* Single-elevation Acoustic Stage */}
            <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-5 space-y-4">
              {/* Explicit accessible status header */}
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2 text-xs font-medium min-w-0">
                  {status === 'connecting' ? (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin text-[#E59A38] shrink-0"
                      aria-hidden="true"
                    />
                  ) : status === 'speaking' ? (
                    <Volume2
                      className="w-3.5 h-3.5 text-[#E59A38] shrink-0"
                      aria-hidden="true"
                    />
                  ) : status === 'listening' && !isMicMuted ? (
                    <Mic
                      className="w-3.5 h-3.5 text-[#F4F6F9] shrink-0"
                      aria-hidden="true"
                    />
                  ) : status === 'error' ? (
                    <AlertCircle
                      className="w-3.5 h-3.5 text-[#F87171] shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <MicOff
                      className="w-3.5 h-3.5 text-[#64748B] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className={`${statusInfo.toneClass} truncate`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-[#64748B] shrink-0">
                  <span>{voice}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDuration(sessionSeconds)}</span>
                </div>
              </div>

              <AcousticOrbCanvas
                status={status}
                inputLevelRef={inputLevelRef}
                outputAnalyserRef={outputAnalyserRef}
              />

              {/* Primary Voice Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {!isLiveActive ? (
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#E59A38] text-[#0B0E14] rounded-lg hover:bg-[#ECA84E] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
                  >
                    <Mic className="w-4 h-4" aria-hidden="true" />
                    <span>Start Conversation</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleMicMute}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38] ${
                        isMicMuted
                          ? 'bg-[#2A1C1E] border-[#F87171]/40 text-[#FCA5A5]'
                          : 'bg-[#19202D] border-white/[0.12] text-[#F4F6F9] hover:bg-white/[0.08]'
                      }`}
                    >
                      {isMicMuted ? (
                        <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                    </button>

                    {status === 'speaking' && (
                      <button
                        type="button"
                        onClick={interruptAssistant}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#19202D] border border-[#E59A38]/40 text-[#E59A38] rounded-lg hover:bg-[#E59A38]/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
                      >
                        <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                        <span>Interrupt</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={endSession}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#19202D] border border-white/[0.12] text-[#CBD5E1] rounded-lg hover:text-[#F4F6F9] hover:border-white/[0.22] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
                    >
                      <PhoneOff className="w-3.5 h-3.5 text-[#F87171]" aria-hidden="true" />
                      <span>End</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-[#231519] border border-[#F87171]/35 text-xs text-[#FCA5A5]"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F87171]" aria-hidden="true" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={dismissError}
                  aria-label="Dismiss error"
                  className="text-[#FCA5A5] hover:text-white p-0.5 shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            <VoiceControlsPanel
              language={language}
              onLanguageChange={setLanguage}
              voice={voice}
              onVoiceChange={setVoice}
              tone={tone}
              onToneChange={setTone}
              isLiveActive={isLiveActive}
              isPreviewingVoice={isPreviewingVoice}
              onPreviewVoice={(line) => void speakText(line)}
            />
          </div>

          {/* Right Stage: Live Bilingual Transcript & Composer */}
          <div className="lg:col-span-7">
            <TranscriptPanel
              transcript={transcript}
              status={status}
              isSendingText={isSendingText}
              isPreviewingVoice={isPreviewingVoice}
              onSendText={sendTextMessage}
              onSpeakText={speakText}
              onClear={clearTranscript}
              onStartVoice={() => void startSession()}
            />
          </div>
        </div>

        {/* Conversation Starters Section */}
        <section id="starters" className="border-t border-white/[0.08] pt-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-[#F4F6F9]">
              Conversation Starters
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Select any prompt to hear Vani respond right away in Hindi, Hinglish, or Indian English.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONVERSATION_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                disabled={isSendingText}
                onClick={() => void sendTextMessage(starter.prompt)}
                className="text-left p-4 rounded-xl bg-[#131822] border border-white/[0.08] hover:border-[#E59A38]/50 hover:bg-[#171D29] disabled:opacity-50 transition-colors flex flex-col justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#E59A38] font-medium">
                    <span>{starter.languageTag}</span>
                    <span aria-hidden="true" className="text-[#475569]">
                      ·
                    </span>
                    <span className="text-[#94A3B8]">{starter.title}</span>
                  </div>
                  <p className="text-sm text-[#E2E8F0] leading-relaxed">
                    “{starter.prompt}”
                  </p>
                </div>
                <span className="text-xs font-medium text-[#94A3B8]">
                  Ask Vani →
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] py-6">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
          <span>Vani Voice Studio — Bilingual Hindi, Indian English &amp; Hinglish Conversation</span>
          <span>Continuous two-way voice with instant turn interruption</span>
        </div>
      </footer>
    </div>
  );
}
