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

export type AnalysisWorkerRequest =
  | { type: "LOAD_AUDIO"; channels: Float32Array[]; sampleRate: number }
  | { type: "ANALYZE"; requestId: number; range: SelectionRange }
  | { type: "EXPORT_WAV"; requestId: number; range: SelectionRange }
  | { type: "CLEAR_AUDIO" };

export type AnalysisWorkerResponse =
  | { type: "ANALYSIS_RESULT"; requestId: number; result: AnalysisResult }
  | { type: "EXPORT_RESULT"; requestId: number; wav: ArrayBuffer }
  | { type: "EXPORT_ERROR"; requestId: number; error: string };
