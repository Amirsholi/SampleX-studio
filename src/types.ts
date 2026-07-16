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
  | { type: "CLEAR_AUDIO" };

export interface AnalysisWorkerResponse {
  requestId: number;
  result: AnalysisResult;
}
