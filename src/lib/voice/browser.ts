"use client";

export type VoiceMode = "elevenlabs" | "browser_tts" | "text_only";

interface RecognitionResultEvent extends Event {
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
  try {
    const response = await fetch("/api/voice/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (response.ok) {
      const objectUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(objectUrl);
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => { URL.revokeObjectURL(objectUrl); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Audio playback failed")); };
        audio.play().catch((error) => { URL.revokeObjectURL(objectUrl); reject(error); });
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

export function transcribeWithBrowser(onInterim?: (text: string) => void): { transcript: Promise<string>; stop: () => void; supported: boolean } {
  const Recognition = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  if (!Recognition) return { transcript: Promise.reject(new Error("Browser speech recognition is unavailable; use text input.")), stop: () => {}, supported: false };
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let finalTranscript = "";
  const transcript = new Promise<string>((resolve, reject) => {
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalTranscript += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      onInterim?.(`${finalTranscript}${interim}`.trim());
    };
    recognition.onerror = (event) => reject(new Error(`Speech recognition failed: ${event.error}`));
    recognition.onend = () => resolve(finalTranscript.trim());
    recognition.start();
  });
  return { transcript, stop: () => recognition.stop(), supported: true };
}
