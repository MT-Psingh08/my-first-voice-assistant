import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(
  languageMode: string = 'auto',
  tonePreset: string = 'warm',
  forTextOnly: boolean = false
): string {
  const languageDirective =
    languageMode === 'hinglish'
      ? 'Always speak in natural, everyday Hinglish—seamlessly blending conversational Hindi and Indian English the way educated urban Indians speak with friends and colleagues (e.g., "Haan bilkul, let us look at that", "Achha, ek minute ruko, main samjhaati hoon"). Use Latin script for Hinglish when transcribing or replying unless Devanagari feels clearer for pure Hindi phrases.'
      : languageMode === 'hindi'
        ? 'Respond primarily in warm, natural, everyday conversational Hindi (Hindustani—using natural words like "aasaan", "zaroor", "bilkul", "samajh", rather than overly stiff Sanskritized textbook Hindi). Only use common English loanwords where any Hindi speaker naturally uses them.'
        : languageMode === 'english'
          ? 'Respond in fluent, warm, articulate Indian English—with natural Indian cadence, phrasing, clear pronunciation of Indian names and cultural references, and approachable warmth.'
          : 'Automatically mirror the user’s language and code-switching effortlessly: if they speak Hindi, reply in natural conversational Hindi; if they speak English, reply in warm Indian English; if they mix Hindi and English (Hinglish), reply in equally natural Hinglish.';

  const toneDirective =
    tonePreset === 'executive'
      ? 'Tone: Confident, sharp, polite, and structured—like an articulate Indian startup leader or executive advisor. Respect the user’s time while staying warm.'
      : tonePreset === 'mentor'
        ? 'Tone: Calm, patient, reassuring, and wise—like a thoughtful Indian mentor who listens deeply and explains clearly without rushing.'
        : tonePreset === 'casual'
          ? 'Tone: Relaxed, friendly, witty, and warm—like a close, smart friend ("yaar" / "dost" energy when appropriate, still respectful).'
          : 'Tone: Warm, genuine, polite, intelligent, and engaging—like a trusted human conversation partner.';

  const deliveryRules = forTextOnly
    ? 'Keep your reply concise (2 to 4 natural sentences unless asked for detail). Avoid markdown formatting, bullet lists, asterisks, or emojis so it sounds effortless when spoken aloud.'
    : [
        'Voice & Accent Delivery:',
        '- Speak with a realistic, warm, natural urban Indian English accent and authentic Hindi/Hinglish pronunciation.',
        '- Maintain natural human pacing: use subtle pauses, gentle warmth, expressive intonation, and conversational rhythm so you never sound robotic, flat, or monotone.',
        '- Use natural conversational acknowledgments sparingly when fitting (such as "Haan, bilkul", "Achha, I see", "Good point").',
        '- Keep spoken turns concise and interactive (2 to 4 sentences usually) so it feels like a genuine two-way dialogue rather than a lecture, unless the user explicitly asks for a longer story or detailed walkthrough.',
        '- Do not output markdown, asterisks, bullet symbols, or emojis—speak purely as natural human speech.',
      ].join('\n');

  return [
    'You are Vani, a smart, human-like bilingual voice assistant and conversation partner.',
    languageDirective,
    toneDirective,
    deliveryRules,
  ].join('\n\n');
}

function buildSpeechStyle(languageMode: string, tonePreset: string): string {
  const accent =
    languageMode === 'hindi'
      ? 'Natural warm Indian Hindustani speaker, expressive and clear'
      : 'Realistic educated Indian English and Hinglish accent, warm melodic intonation, natural human pauses';

  const mood =
    tonePreset === 'executive'
      ? 'confident, articulate, polite, composed'
      : tonePreset === 'mentor'
        ? 'calm, reassuring, thoughtful, unhurried'
        : tonePreset === 'casual'
          ? 'friendly, conversational, upbeat, natural'
          : 'warm, friendly, intelligent, conversational';

  return `${accent}; ${mood}; avoid robotic monotone`;
}

const VALID_VOICES = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);

function sanitizeVoice(voice: unknown): string {
  if (typeof voice === 'string' && VALID_VOICES.has(voice)) {
    return voice;
  }
  return 'Kore';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/voice-turn', async (req: Request, res: Response) => {
    try {
      const { message, history, language, tone, voice } = req.body ?? {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'A text message is required.' });
        return;
      }

      const ai = getAiClient();
      const voiceName = sanitizeVoice(voice);
      const languageMode = typeof language === 'string' ? language : 'auto';
      const tonePreset = typeof tone === 'string' ? tone : 'warm';
      const systemInstruction = buildSystemInstruction(languageMode, tonePreset, true);

      const formattedHistory = Array.isArray(history)
        ? history
            .slice(-10)
            .filter(
              (item): item is { role: 'user' | 'assistant'; text: string } =>
                item &&
                (item.role === 'user' || item.role === 'assistant') &&
                typeof item.text === 'string' &&
                item.text.trim().length > 0
            )
            .map((item) => ({
              role: item.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: item.text }],
            }))
        : [];

      const textResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...formattedHistory,
          { role: 'user', parts: [{ text: message.trim() }] },
        ],
        config: {
          systemInstruction,
        },
      });

      const replyText = (textResponse.text ?? '').trim();
      if (!replyText) {
        res.status(502).json({ error: 'Empty response generated from Gemini.' });
        return;
      }

      let audioBase64: string | null = null;
      try {
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: replyText,
                  speechMetadata: {
                    style: buildSpeechStyle(languageMode, tonePreset),
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        audioBase64 =
          ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      } catch (ttsError) {
        console.error('TTS generation error:', ttsError);
      }

      res.json({
        text: replyText,
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      console.error('Error in /api/voice-turn:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate voice turn.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const { text, voice, language, tone } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const ai = getAiClient();
      const voiceName = sanitizeVoice(voice);
      const languageMode = typeof language === 'string' ? language : 'auto';
      const tonePreset = typeof tone === 'string' ? tone : 'warm';

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: buildSpeechStyle(languageMode, tonePreset),
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioBase64 =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;

      if (!audioBase64) {
        res.status(502).json({ error: 'No audio returned by speech model.' });
        return;
      }

      res.json({ audioBase64, mimeType: 'audio/wav' });
    } catch (err) {
      console.error('Error in /api/tts:', err);
      const message = err instanceof Error ? err.message : 'Failed to synthesize speech.';
      res.status(500).json({ error: message });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;

    const sendSafe = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const cleanupSession = () => {
      if (isClosing) return;
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close errors
        }
        liveSession = null;
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type?: string;
          voice?: string;
          language?: string;
          tone?: string;
          autoGreet?: boolean;
          data?: string;
          text?: string;
        };

        if (msg.type === 'start') {
          if (liveSession) {
            try {
              liveSession.close();
            } catch {
              // ignore
            }
            liveSession = null;
          }

          const ai = getAiClient();
          const voiceName = sanitizeVoice(msg.voice);
          const languageMode = msg.language || 'auto';
          const tonePreset = msg.tone || 'warm';
          const systemInstruction = buildSystemInstruction(languageMode, tonePreset, false);

          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction,
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                const content = message.serverContent;
                if (!content) return;

                if (content.interrupted) {
                  sendSafe({ type: 'interrupted' });
                }

                if (content.inputTranscription?.text) {
                  sendSafe({
                    type: 'inputTranscript',
                    text: content.inputTranscription.text,
                  });
                }

                if (content.outputTranscription?.text) {
                  sendSafe({
                    type: 'outputTranscript',
                    text: content.outputTranscription.text,
                  });
                }

                for (const part of content.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    sendSafe({
                      type: 'audio',
                      data: part.inlineData.data,
                    });
                  }
                }

                if (content.turnComplete) {
                  sendSafe({ type: 'turnComplete' });
                }
              },
              onerror: (errEvent) => {
                console.error('Gemini Live session error:', errEvent);
                const detail =
                  errEvent && typeof errEvent === 'object' && 'message' in errEvent
                    ? String((errEvent as { message?: unknown }).message)
                    : 'Live voice connection encountered an error.';
                sendSafe({
                  type: 'error',
                  message: detail,
                });
              },
              onclose: () => {
                sendSafe({ type: 'closed' });
              },
            },
          });

          sendSafe({ type: 'ready' });

          if (msg.autoGreet !== false && liveSession) {
            const greetingTrigger =
              languageMode === 'hindi'
                ? 'Namaste! User ne abhi conversation start ki hai. Warm Hindi mein 1-2 short sentences mein greet karo.'
                : languageMode === 'english'
                  ? 'Hello! The user just started a voice conversation. Greet them warmly in 1-2 short sentences in Indian English.'
                  : 'Namaste! User ne abhi conversation start ki hai. Warm Hinglish mein 1-2 short sentences mein greet karo aur pucho aaj kis baare mein baat karein.';
            setTimeout(() => {
              if (liveSession && !isClosing) {
                liveSession.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: greetingTrigger }] }],
                  turnComplete: true,
                });
              }
            }, 250);
          }
          return;
        }

        if (msg.type === 'audio' && msg.data && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
          return;
        }

        if (msg.type === 'text' && msg.text && liveSession) {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
          return;
        }

        if (msg.type === 'stop') {
          cleanupSession();
          sendSafe({ type: 'closed' });
        }
      } catch (err) {
        console.error('WebSocket message handling error:', err);
        sendSafe({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to process live voice stream.',
        });
      }
    });

    clientWs.on('close', cleanupSession);
    clientWs.on('error', cleanupSession);
  });

  if (IS_PROD) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Vani voice assistant server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
