import { analyzePcm } from "./analyzeSelection";
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

  const response: AnalysisWorkerResponse = {
    requestId: event.data.requestId,
    result: analyzePcm(channels, sampleRate, event.data.range),
  };
  self.postMessage(response);
};
