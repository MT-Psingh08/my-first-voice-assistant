import { useEffect, useRef, type MutableRefObject } from 'react';
import type { SessionStatus } from '../types/voice';

interface AcousticOrbCanvasProps {
  status: SessionStatus;
  inputLevelRef: MutableRefObject<number>;
  outputAnalyserRef: MutableRefObject<AnalyserNode | null>;
}

export function AcousticOrbCanvas({
  status,
  inputLevelRef,
  outputAnalyserRef,
}: AcousticOrbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<SessionStatus>(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let animationId = 0;
    let smoothedOutput = 0;
    let smoothedInput = 0;
    let phase = 0;
    const freqData = new Uint8Array(64);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.27;

      ctx.clearRect(0, 0, width, height);

      const currentStatus = statusRef.current;
      const analyser = outputAnalyserRef.current;

      let outputEnergy = 0;
      if (analyser && (currentStatus === 'speaking' || currentStatus === 'idle')) {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        const bins = 28;
        for (let i = 0; i < bins; i++) {
          sum += freqData[i];
        }
        outputEnergy = sum / (bins * 255);
      }

      const rawInput = inputLevelRef.current;
      smoothedInput += (rawInput - smoothedInput) * 0.22;
      smoothedOutput += (outputEnergy - smoothedOutput) * 0.25;

      const isSpeaking = currentStatus === 'speaking' || smoothedOutput > 0.03;
      const isListening = currentStatus === 'listening';
      const isConnecting = currentStatus === 'connecting';

      if (!prefersReducedMotion) {
        phase += isSpeaking ? 0.045 : isListening ? 0.026 : 0.014;
      }

      const activeEnergy = isSpeaking
        ? smoothedOutput
        : isListening
          ? smoothedInput
          : 0;

      // Subtle radial studio glow behind harmonic rings
      const glowRadius = baseRadius * (1.85 + activeEnergy * 0.55);
      const radial = ctx.createRadialGradient(cx, cy, baseRadius * 0.2, cx, cy, glowRadius);
      if (isSpeaking) {
        radial.addColorStop(0, 'rgba(229, 154, 56, 0.22)');
        radial.addColorStop(0.55, 'rgba(229, 154, 56, 0.06)');
        radial.addColorStop(1, 'rgba(11, 14, 20, 0)');
      } else if (isListening) {
        radial.addColorStop(0, 'rgba(226, 232, 240, 0.14)');
        radial.addColorStop(0.6, 'rgba(229, 154, 56, 0.04)');
        radial.addColorStop(1, 'rgba(11, 14, 20, 0)');
      } else {
        radial.addColorStop(0, 'rgba(148, 163, 184, 0.08)');
        radial.addColorStop(1, 'rgba(11, 14, 20, 0)');
      }
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Concentric harmonic wave rings
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringRatio = 1 + r * 0.22;
        const points = 96;
        ctx.beginPath();

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const binIndex = i % 28;
          const binFactor = isSpeaking && analyser ? freqData[binIndex] / 255 : 0;

          const waveAmp =
            (isSpeaking ? 6 + binFactor * 18 : isListening ? 2.5 + smoothedInput * 16 : 1.5) *
            (1 - r * 0.2);

          const harmonic =
            Math.sin(angle * (3 + r) + phase * (1 + r * 0.35)) * waveAmp * 0.65 +
            Math.cos(angle * (5 - r) - phase * 0.8) * waveAmp * 0.35;

          const radius =
            baseRadius * ringRatio +
            harmonic +
            (isConnecting ? Math.sin(phase * 2 + r) * 3 : 0);

          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        if (isSpeaking) {
          ctx.strokeStyle =
            r === 0
              ? 'rgba(229, 154, 56, 0.88)'
              : r === 1
                ? 'rgba(229, 154, 56, 0.42)'
                : 'rgba(229, 154, 56, 0.18)';
          ctx.lineWidth = r === 0 ? 2 : 1.25;
        } else if (isListening) {
          ctx.strokeStyle =
            r === 0
              ? `rgba(244, 246, 249, ${0.48 + smoothedInput * 0.4})`
              : r === 1
                ? 'rgba(229, 154, 56, 0.34)'
                : 'rgba(148, 163, 184, 0.16)';
          ctx.lineWidth = r === 0 ? 1.8 : 1.1;
        } else {
          ctx.strokeStyle =
            r === 0
              ? 'rgba(148, 163, 184, 0.32)'
              : r === 1
                ? 'rgba(148, 163, 184, 0.16)'
                : 'rgba(148, 163, 184, 0.08)';
          ctx.lineWidth = 1.1;
        }
        ctx.stroke();
      }

      // Inner acoustic core circle
      const coreRadius = baseRadius * (0.48 + activeEnergy * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSpeaking
        ? 'rgba(229, 154, 56, 0.16)'
        : isListening
          ? 'rgba(244, 246, 249, 0.08)'
          : 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = isSpeaking
        ? 'rgba(229, 154, 56, 0.6)'
        : isListening
          ? 'rgba(244, 246, 249, 0.25)'
          : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Subtle center acoustic bar meter inside core
      const barCount = 5;
      const barSpacing = 6;
      const totalWidth = (barCount - 1) * barSpacing;
      for (let b = 0; b < barCount; b++) {
        const bx = cx - totalWidth / 2 + b * barSpacing;
        const offset = Math.abs(b - 2);
        const mod = isSpeaking
          ? 8 + smoothedOutput * 26 * (1 - offset * 0.22) + Math.sin(phase * 3 + b) * 4
          : isListening
            ? 5 + smoothedInput * 22 * (1 - offset * 0.22) + Math.sin(phase * 2 + b) * 2
            : 4 + (2 - offset) * 2.5;
        const bh = Math.max(4, mod);

        ctx.strokeStyle = isSpeaking
          ? '#E59A38'
          : isListening
            ? '#F4F6F9'
            : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, cy - bh / 2);
        ctx.lineTo(bx, cy + bh / 2);
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        animationId = window.requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [inputLevelRef, outputAnalyserRef]);

  return (
    <div className="relative w-full h-56 sm:h-64 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        aria-label="Live acoustic voice visualizer"
        className="w-full h-full block"
      />
    </div>
  );
}
