import { saveLatestRecording } from "../audio/recordingStore";
import type { ExtensionMessage } from "./messages";

let recorder: MediaRecorder | null = null;
let captureStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let chunks: BlobPart[] = [];
let sourceTitle = "Tab audio";
let liveTimer: number | null = null;
let stopPromise: Promise<void> | null = null;
let workletNode: AudioWorkletNode | null = null;
let pcmChunks: Float32Array[][] = [];
let captureMode: "pcm" | "media-recorder" | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_START") {
    void start(message.streamId, message.sourceTitle).then(() => sendResponse({ ok: true })).catch(reportError);
    return true;
  }
  if (message.type === "OFFSCREEN_STOP") {
    void stop().then(() => sendResponse({ ok: true })).catch(reportError);
    return true;
  }
  return false;

  function reportError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    void chrome.runtime.sendMessage({ type: "RECORDING_ERROR", error: text } satisfies ExtensionMessage);
    sendResponse({ ok: false, error: text });
  }
});

async function start(streamId: string, title: string) {
  if (recorder?.state === "recording") throw new Error("A recording is already active.");
  sourceTitle = title;
  chunks = [];
  pcmChunks = [];
  try {
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } } as MediaTrackConstraints,
      video: false,
    });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(captureStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const waveform = new Uint8Array(analyser.frequencyBinCount);
    liveTimer = window.setInterval(() => {
      analyser.getByteTimeDomainData(waveform);
      void chrome.runtime.sendMessage({ type: "LIVE_WAVEFORM", samples: Array.from(waveform) } satisfies ExtensionMessage).catch(() => undefined);
    }, 70);

    try {
      await startPcmCapture(source, audioContext);
      captureMode = "pcm";
    } catch {
      source.connect(audioContext.destination);
      const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find(MediaRecorder.isTypeSupported);
      recorder = new MediaRecorder(captureStream, mimeType ? { mimeType, audioBitsPerSecond: 256_000 } : { audioBitsPerSecond: 256_000 });
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.start(250);
      captureMode = "media-recorder";
    }
    captureStream.getAudioTracks()[0]?.addEventListener("ended", () => void stop());
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function stop() {
  if (stopPromise) return stopPromise;
  if (!captureMode) return;
  stopPromise = finishRecording();
  try {
    await stopPromise;
  } finally {
    stopPromise = null;
  }
}

async function finishRecording() {
  let blob: Blob;
  if (captureMode === "pcm") {
    await flushPcmCapture();
    const wav = await finalizePcmRecording(pcmChunks, audioContext?.sampleRate ?? 48_000);
    pcmChunks = [];
    blob = new Blob([wav], { type: "audio/wav" });
  } else {
    const activeRecorder = recorder!;
    await new Promise<void>((resolve) => {
      activeRecorder.addEventListener("stop", () => resolve(), { once: true });
      activeRecorder.stop();
    });
    blob = new Blob(chunks, { type: activeRecorder.mimeType || "audio/webm" });
  }
  cleanup();
  if (!blob.size) throw new Error("No audio was recorded.");
  await saveLatestRecording({ blob, createdAt: Date.now(), sourceTitle });
  await chrome.runtime.sendMessage({ type: "RECORDING_SAVED" } satisfies ExtensionMessage);
}

function cleanup() {
  if (liveTimer !== null) window.clearInterval(liveTimer);
  liveTimer = null;
  captureStream?.getTracks().forEach((track) => track.stop());
  void audioContext?.close();
  recorder = null;
  workletNode?.disconnect();
  workletNode = null;
  captureStream = null;
  audioContext = null;
  chunks = [];
  pcmChunks = [];
  captureMode = null;
}

async function startPcmCapture(source: MediaStreamAudioSourceNode, context: AudioContext) {
  await context.audioWorklet.addModule(chrome.runtime.getURL("pcm-capture-worklet.js"));
  workletNode = new AudioWorkletNode(context, "samplex-pcm-capture");
  workletNode.port.onmessage = (event: MessageEvent<{ type: string; channels?: Float32Array[] }>) => {
    if (event.data.type !== "PCM_CHUNK" || !event.data.channels) return;
    if (pcmChunks.length !== event.data.channels.length) {
      pcmChunks = Array.from({ length: event.data.channels.length }, () => []);
    }
    event.data.channels.forEach((channel, index) => pcmChunks[index].push(channel));
  };
  source.connect(workletNode);
  workletNode.connect(context.destination);
}

function flushPcmCapture() {
  return new Promise<void>((resolve) => {
    if (!workletNode) return resolve();
    const handleMessage = (event: MessageEvent<{ type: string }>) => {
      if (event.data.type !== "FLUSHED") return;
      workletNode?.port.removeEventListener("message", handleMessage);
      resolve();
    };
    workletNode.port.addEventListener("message", handleMessage);
    workletNode.port.postMessage({ type: "FLUSH" });
  });
}

function finalizePcmRecording(chunksByChannel: Float32Array[][], sampleRate: number) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(new URL("../audio/pcmFinalize.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; wav?: ArrayBuffer; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.wav) resolve(event.data.wav);
      else reject(new Error(event.data.error ?? "The recording could not be finalized."));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "The recording could not be finalized."));
    };
    worker.postMessage(
      { chunksByChannel, sampleRate },
      chunksByChannel.flatMap((channel) => channel.map((chunk) => chunk.buffer)),
    );
  });
}
