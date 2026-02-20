/**
 * Web Speech API — speech-to-text (no API key, browser built-in).
 * Best in Chrome/Edge.
 */

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; length: number; [i: number]: { transcript: string } };
}

interface SpeechRecognitionResultEvent {
  results: SpeechRecognitionResultList;
}

/**
 * Convert "at Thomas create a castle" → "@thomas create a castle" for @mentions.
 */
export function normalizeAtMention(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^at\s+(\w+)(?:\s+(.*))?$/i);
  if (match) {
    const name = match[1].toLowerCase();
    const rest = match[2] ?? "";
    return `@${name} ${rest}`.trim();
  }
  return trimmed;
}

/**
 * Start listening; onResult is called with final transcript, onError on failure.
 * Returns the recognition instance so caller can call stop().
 */
export function startListening(
  onResult: (text: string) => void,
  onError: (error: string) => void
): SpeechRecognitionInstance | null {
  const SpeechRecognition = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : undefined;

  if (!SpeechRecognition) {
    onError("Speech recognition not supported in this browser");
    return null;
  }

  const recognition = new SpeechRecognition() as SpeechRecognitionInstance;
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event: SpeechRecognitionResultEvent) => {
    const results = event.results;
    const last = results[results.length - 1];
    const transcript = last[0].transcript;
    if (last.isFinal) {
      onResult(transcript);
    }
  };

  recognition.onerror = (event: { error: string }) => {
    if (event.error !== "aborted") {
      onError(event.error);
    }
  };

  recognition.start();
  return recognition;
}
