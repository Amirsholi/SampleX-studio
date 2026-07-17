import { analyzePcm } from "./analyzeSelection";
import { encodePcmSelectionAsWav } from "./exportWav";
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from "../types";

let channels: Float32Array[] | null = null;
let sampleRate = 0;

self.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  if (event.data.type === "LOAD_AUDIO") {
    channels = event.data.channels;
    sampleRate = event.data.sampleRate;
    return;
  }
  if (event.data.type === "CLEAR_AUDIO") {
    channels = null;
    sampleRate = 0;
    return;
  }
  if (!channels || !sampleRate) return;

  if (event.data.type === "ANALYZE") {
    const response: AnalysisWorkerResponse = {
      type: "ANALYSIS_RESULT",
      requestId: event.data.requestId,
      result: analyzePcm(channels, sampleRate, event.data.range),
    };
    self.postMessage(response);
    return;
  }

  try {
    const wav = encodePcmSelectionAsWav(channels, sampleRate, event.data.range);
    const response: AnalysisWorkerResponse = { type: "EXPORT_RESULT", requestId: event.data.requestId, wav };
    self.postMessage(response, { transfer: [wav] });
  } catch (error) {
    const response: AnalysisWorkerResponse = {
      type: "EXPORT_ERROR",
      requestId: event.data.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
