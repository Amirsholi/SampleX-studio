import { analyzePcm } from "./analyzeSelection";
import type { SelectionRange } from "../types";

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number; range: SelectionRange }>) => {
  const { channels, sampleRate, range } = event.data;
  self.postMessage(analyzePcm(channels, sampleRate, range));
};
