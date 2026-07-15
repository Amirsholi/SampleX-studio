export type RecordingState = "idle" | "requesting" | "recording" | "ready" | "error";

export interface SelectionRange {
  start: number;
  end: number;
}

export interface RecordedSample {
  name: string;
  blob: Blob;
  url: string;
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
}

export interface AnalysisResult {
  bpm: number | null;
  key: string | null;
  frequencyHz: number | null;
  note: string | null;
  confidence: number;
  duration: number;
  channels: "Mono" | "Stereo";
}
