export type RecordingStatus = "idle" | "starting" | "recording" | "stopping" | "ready" | "error";

export interface ExtensionState {
  status: RecordingStatus;
  startedAt?: number;
  error?: string;
  sourceTitle?: string;
  sourceTabId?: number;
}

export type ExtensionMessage =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "GET_STATE" }
  | { type: "OFFSCREEN_START"; streamId: string; sourceTitle: string }
  | { type: "OFFSCREEN_STOP" }
  | { type: "RECORDING_SAVED" }
  | { type: "LIVE_WAVEFORM"; samples: number[] }
  | { type: "RECORDING_ERROR"; error: string };
