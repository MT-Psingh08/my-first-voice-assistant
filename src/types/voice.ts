export type VoiceName = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export type LanguageMode = 'auto' | 'hinglish' | 'hindi' | 'english';

export type TonePreset = 'warm' | 'executive' | 'mentor' | 'casual';

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'paused'
  | 'error';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isPartial?: boolean;
  source?: 'live' | 'text';
}

export interface VoiceOption {
  id: VoiceName;
  label: string;
  character: string;
  sampleLine: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'Kore',
    label: 'Kore',
    character: 'Warm, articulate & poised',
    sampleLine:
      'Namaste! Main Vani hoon. Tell me, aaj hum kis cheez par kaam karein?',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    character: 'Bright, friendly & upbeat',
    sampleLine:
      'Hey there! Bilkul ready hoon—Hindi, English ya Hinglish, bas shuru kijiye.',
  },
  {
    id: 'Puck',
    label: 'Puck',
    character: 'Lively, expressive & quick-witted',
    sampleLine:
      'Arre waah, chalo kuch interesting discuss karte hain! What is on your mind today?',
  },
  {
    id: 'Charon',
    label: 'Charon',
    character: 'Calm, grounded & thoughtful',
    sampleLine:
      'Hello, main dhyaan se sun raha hoon. Take your time, let us talk it through.',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    character: 'Confident, resonant & crisp',
    sampleLine:
      'Good to connect! Let us get straight to the point—aapka sawal kya hai?',
  },
];

export const LANGUAGE_OPTIONS: { id: LanguageMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto-Switch', hint: 'Mirrors Hindi, English, or Hinglish naturally' },
  { id: 'hinglish', label: 'Hinglish', hint: 'Natural everyday Hindi + English blend' },
  { id: 'hindi', label: 'Hindi', hint: 'Warm, conversational Hindustani' },
  { id: 'english', label: 'Indian English', hint: 'Natural Indian accent & phrasing' },
];

export const TONE_OPTIONS: { id: TonePreset; label: string; description: string }[] = [
  { id: 'warm', label: 'Warm & Friendly', description: 'Approachable, natural pacing' },
  { id: 'executive', label: 'Polished & Crisp', description: 'Clear, confident & focused' },
  { id: 'mentor', label: 'Calm Mentor', description: 'Patient, thoughtful guidance' },
  { id: 'casual', label: 'Casual Dost', description: 'Relaxed everyday banter' },
];

export interface ConversationStarter {
  id: string;
  languageTag: string;
  title: string;
  prompt: string;
}

export const CONVERSATION_STARTERS: ConversationStarter[] = [
  {
    id: 'hinglish-plan',
    languageTag: 'Hinglish',
    title: 'Weekend plan brainstorm',
    prompt: 'Yaar, is weekend kuch relaxing aur fun plan karna hai—kuch ideas suggest karo na, budget friendly ho.',
  },
  {
    id: 'hindi-explain',
    languageTag: 'Hindi',
    title: 'Explain simply in Hindi',
    prompt: 'Mujhe bilkul aasaan aur natural Hindi mein samjhao ki compound interest kaise kaam karta hai.',
  },
  {
    id: 'indian-english-prep',
    languageTag: 'Indian English',
    title: 'Interview confidence check',
    prompt: 'Can we do a quick two-minute mock interview for a product manager role? Ask me one thoughtful opening question.',
  },
  {
    id: 'hinglish-chai',
    languageTag: 'Hinglish',
    title: 'Quick masala chai recipe',
    prompt: 'Ekdum kadak adrak-elaichi masala chai banane ka perfect tareeka batao, step by step.',
  },
];
