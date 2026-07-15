import { saveLatestRecording } from "../audio/recordingStore";
import type { ExtensionMessage } from "./messages";

let recorder: MediaRecorder | null = null;
let captureStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let chunks: BlobPart[] = [];
let sourceTitle = "Tab audio";
let liveTimer: number | null = null;
let stopPromise: Promise<void> | null = null;

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
  try {
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } } as MediaTrackConstraints,
      video: false,
    });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(captureStream);
    source.connect(audioContext.destination);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const waveform = new Uint8Array(analyser.frequencyBinCount);
    liveTimer = window.setInterval(() => {
      analyser.getByteTimeDomainData(waveform);
      void chrome.runtime.sendMessage({ type: "LIVE_WAVEFORM", samples: Array.from(waveform) } satisfies ExtensionMessage).catch(() => undefined);
    }, 70);

    const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find(MediaRecorder.isTypeSupported);
    recorder = new MediaRecorder(captureStream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.start(250);
    captureStream.getAudioTracks()[0]?.addEventListener("ended", () => void stop());
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function stop() {
  if (stopPromise) return stopPromise;
  if (!recorder || recorder.state === "inactive") return;
  stopPromise = finishRecording();
  try {
    await stopPromise;
  } finally {
    stopPromise = null;
  }
}

async function finishRecording() {
  const activeRecorder = recorder!;
  await new Promise<void>((resolve) => {
    activeRecorder.addEventListener("stop", () => resolve(), { once: true });
    activeRecorder.stop();
  });
  const blob = new Blob(chunks, { type: activeRecorder.mimeType || "audio/webm" });
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
  captureStream = null;
  audioContext = null;
  chunks = [];
}
