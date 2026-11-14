import { Volume2, Loader2 } from 'lucide-react';
import {
  LANGUAGE_OPTIONS,
  TONE_OPTIONS,
  VOICE_OPTIONS,
  type LanguageMode,
  type TonePreset,
  type VoiceName,
} from '../types/voice';

interface VoiceControlsPanelProps {
  language: LanguageMode;
  onLanguageChange: (language: LanguageMode) => void;
  voice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  tone: TonePreset;
  onToneChange: (tone: TonePreset) => void;
  isLiveActive: boolean;
  isPreviewingVoice: boolean;
  onPreviewVoice: (sampleText: string) => void;
}

export function VoiceControlsPanel({
  language,
  onLanguageChange,
  voice,
  onVoiceChange,
  tone,
  onToneChange,
  isLiveActive,
  isPreviewingVoice,
  onPreviewVoice,
}: VoiceControlsPanelProps) {
  const selectedVoice =
    VOICE_OPTIONS.find((v) => v.id === voice) ?? VOICE_OPTIONS[0];
  const selectedLanguage =
    LANGUAGE_OPTIONS.find((l) => l.id === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <section
      id="voice-profile"
      aria-label="Voice and language preferences"
      className="space-y-6 pt-2"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.08] pb-3">
        <h2 className="text-base font-semibold text-[#F4F6F9]">
          Voice &amp; Language Profile
        </h2>
        {isLiveActive && (
          <span className="text-xs text-[#94A3B8]">
            Changes apply on next session start
          </span>
        )}
      </div>

      {/* Language Mode */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-[#94A3B8]">
            Conversation Language
          </span>
          <span className="text-xs text-[#64748B] truncate">
            {selectedLanguage.hint}
          </span>
        </div>
        <div
          role="group"
          aria-label="Conversation language mode"
          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#131822] border border-white/[0.08] rounded-lg"
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = language === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onLanguageChange(opt.id)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38] ${
                  active
                    ? 'bg-[#E59A38] text-[#0B0E14]'
                    : 'text-[#CBD5E1] hover:text-[#F4F6F9] hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice Persona */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs font-medium text-[#94A3B8] shrink-0">
              Voice Persona
            </span>
            <span className="text-xs text-[#64748B] truncate">
              {selectedVoice.character}
            </span>
          </div>
          <button
            type="button"
            disabled={isPreviewingVoice}
            onClick={() => onPreviewVoice(selectedVoice.sampleLine)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E59A38] border border-[#E59A38]/30 rounded-md hover:bg-[#E59A38]/10 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38]"
          >
            {isPreviewingVoice ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Preview {selectedVoice.label}</span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Voice persona selector"
          className="grid grid-cols-5 gap-1.5 p-1 bg-[#131822] border border-white/[0.08] rounded-lg"
        >
          {VOICE_OPTIONS.map((opt) => {
            const active = voice === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onVoiceChange(opt.id)}
                className={`px-2 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38] ${
                  active
                    ? 'bg-white/[0.12] text-[#F4F6F9]'
                    : 'text-[#94A3B8] hover:text-[#F4F6F9] hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone Preset */}
      <div className="space-y-2.5">
        <span className="block text-xs font-medium text-[#94A3B8]">
          Conversational Tone
        </span>
        <div
          role="group"
          aria-label="Conversational tone selector"
          className="grid grid-cols-2 gap-2"
        >
          {TONE_OPTIONS.map((opt) => {
            const active = tone === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToneChange(opt.id)}
                className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59A38] ${
                  active
                    ? 'bg-[#19202D] border-[#E59A38]/60 text-[#F4F6F9]'
                    : 'bg-[#131822] border-white/[0.08] text-[#CBD5E1] hover:border-white/[0.18]'
                }`}
              >
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
