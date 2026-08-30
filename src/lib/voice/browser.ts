"use client";

export type VoiceMode = "elevenlabs" | "browser_tts" | "text_only";

let activeAudio: HTMLAudioElement | null = null;
let cancelActiveAudio: (() => void) | null = null;

export function stopInterviewPrompt() {
  cancelActiveAudio?.();
  if (activeAudio) { activeAudio.pause(); activeAudio.src = ""; activeAudio = null; }
  cancelActiveAudio = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

interface RecognitionResultEvent extends Event {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface BrowserRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => BrowserRecognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export async function speakInterviewPrompt(text: string): Promise<VoiceMode> {
  if (typeof window === "undefined" || typeof Audio === "undefined") return "text_only";
  stopInterviewPrompt();
  try {
    const response = await fetch("/api/voice/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (response.ok) {
      const objectUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(objectUrl);
      activeAudio = audio;
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const finish = () => { if (finished) return; finished = true; activeAudio = null; cancelActiveAudio = null; URL.revokeObjectURL(objectUrl); resolve(); };
        cancelActiveAudio = finish;
        audio.onended = finish;
        audio.onerror = () => { if (finished) return; finished = true; activeAudio = null; cancelActiveAudio = null; URL.revokeObjectURL(objectUrl); reject(new Error("Audio playback failed")); };
        audio.play().catch((error) => { if (finished) return; finished = true; activeAudio = null; cancelActiveAudio = null; URL.revokeObjectURL(objectUrl); reject(error); });
      });
      return "elevenlabs";
    }
  } catch {}
  if ("speechSynthesis" in window) {
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser speech synthesis failed"));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
    return "browser_tts";
  }
  return "text_only";
}

export function transcribeWithBrowser(onInterim?: (text: string) => void, options: { silenceMs?: number; maxDurationMs?: number } = {}): { transcript: Promise<string>; stop: () => void; supported: boolean } {
  const Recognition = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  if (!Recognition) return { transcript: Promise.reject(new Error("Browser speech recognition is unavailable; use text input.")), stop: () => {}, supported: false };
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let finalTranscript = "";
  let interimTranscript = "";
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  const clearTimers = () => { if (silenceTimer) clearTimeout(silenceTimer); if (maxTimer) clearTimeout(maxTimer); };
  const transcript = new Promise<string>((resolve, reject) => {
    recognition.onresult = (event) => {
      interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalTranscript += `${result[0].transcript} `;
        else interimTranscript += result[0].transcript;
      }
      const combined = `${finalTranscript}${interimTranscript}`.trim();
      onInterim?.(combined);
      if (combined && options.silenceMs) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => recognition.stop(), options.silenceMs);
      }
    };
    recognition.onerror = (event) => {
      clearTimers();
      if (event.error === "no-speech") resolve("");
      else reject(new Error(`Speech recognition failed: ${event.error}`));
    };
    recognition.onend = () => { clearTimers(); resolve(`${finalTranscript}${interimTranscript}`.trim()); };
    maxTimer = setTimeout(() => recognition.stop(), options.maxDurationMs ?? 90000);
    recognition.start();
  });
  return { transcript, stop: () => recognition.stop(), supported: true };
}
