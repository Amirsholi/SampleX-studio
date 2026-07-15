import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Circle, Download, Pause, Pencil, Play, Square, Trash2 } from "lucide-react";
import { decodeAudioBlob } from "./audio/decodeAudio";
import { exportSelectionAsWav } from "./audio/exportWav";
import { deleteLatestRecording, getLatestRecording } from "./audio/recordingStore";
import type { ExtensionMessage, ExtensionState } from "./extension/messages";
import type { AnalysisResult, SelectionRange } from "./types";

const EMPTY_RANGE = { start: 0, end: 0 };
const EMPTY_STATE: ExtensionState = { status: "idle" };

export default function App() {
  const waveformElement = useRef<HTMLDivElement | null>(null);
  const liveCanvas = useRef<HTMLCanvasElement | null>(null);
  const waveform = useRef<WaveSurfer | null>(null);
  const region = useRef<Region | null>(null);
  const leftShade = useRef<Region | null>(null);
  const rightShade = useRef<Region | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const worker = useRef<Worker | null>(null);
  const analysisTimer = useRef<number | null>(null);
  const objectUrl = useRef<string | null>(null);
  const liveBars = useRef<number[]>([]);
  const [extensionState, setExtensionState] = useState<ExtensionState>(EMPTY_STATE);
  const [sampleName, setSampleName] = useState("No audio captured");
  const [range, setRange] = useState<SelectionRange>(EMPTY_RANGE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);

  const recording = extensionState.status === "recording";
  const showingCapture = recording || extensionState.status === "stopping";
  const busy = extensionState.status === "starting" || extensionState.status === "stopping";
  const hasAudio = Boolean(buffer.current && objectUrl.current);

  useEffect(() => {
    worker.current = new Worker(new URL("./audio/analysis.worker.ts", import.meta.url), { type: "module" });
    worker.current.onmessage = (event: MessageEvent<AnalysisResult>) => {
      setAnalysis(event.data);
      setAnalyzing(false);
    };
    if (hasChrome()) {
      void refreshState();
      const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
        const next = changes.recordingState?.newValue as ExtensionState | undefined;
        if (!next) return;
        setExtensionState(next);
        if (next.status === "ready") void loadRecording();
      };
      const messageListener = (message: ExtensionMessage) => {
        if (message.type === "LIVE_WAVEFORM") drawLiveWaveform(message.samples);
      };
      chrome.storage.onChanged.addListener(storageListener);
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.storage.onChanged.removeListener(storageListener);
        chrome.runtime.onMessage.removeListener(messageListener);
        cleanup();
      };
    }
    return cleanup;
  }, []);

  useEffect(() => {
    if (!recording || !extensionState.startedAt) {
      if (extensionState.status === "idle") setElapsed(0);
      return;
    }
    const update = () => setElapsed((Date.now() - extensionState.startedAt!) / 1000);
    update();
    const timer = window.setInterval(update, 150);
    return () => window.clearInterval(timer);
  }, [recording, extensionState.startedAt, extensionState.status]);

  async function refreshState() {
    const next = await chrome.runtime.sendMessage({ type: "GET_STATE" } satisfies ExtensionMessage) as ExtensionState;
    setExtensionState(next);
    if (next.status === "ready") await loadRecording();
  }

  async function loadRecording() {
    const stored = await getLatestRecording();
    if (!stored) return;
    waveform.current?.destroy();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const decoded = await decodeAudioBlob(stored.blob);
    const url = URL.createObjectURL(stored.blob);
    objectUrl.current = url;
    buffer.current = decoded;
    setSampleName(stored.sourceTitle || "Untitled sample");
    setElapsed(decoded.duration);
    mountWaveform(url);
  }

  function mountWaveform(url: string) {
    if (!waveformElement.current) return;
    const regions = RegionsPlugin.create();
    const instance = WaveSurfer.create({
      container: waveformElement.current,
      url,
      height: 140,
      waveColor: ["#53616b", "#aab8bf", "#667681"],
      progressColor: ["#9cc7cd", "#f0e2c8", "#78b8c2"],
      cursorColor: "#ffb45f",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 0,
      normalize: true,
      interact: true,
      plugins: [regions],
    });
    waveform.current = instance;
    instance.on("play", () => setPlaying(true));
    instance.on("pause", () => setPlaying(false));
    instance.on("finish", () => setPlaying(false));
    instance.on("ready", () => {
      const duration = instance.getDuration();
      const startShade = regions.addRegion({ id: "trim-shade-start", start: 0, end: 0, color: "rgba(2, 5, 8, .68)", drag: false, resize: false });
      const endShade = regions.addRegion({ id: "trim-shade-end", start: duration, end: duration, color: "rgba(2, 5, 8, .68)", drag: false, resize: false });
      if (startShade.element) startShade.element.style.pointerEvents = "none";
      if (endShade.element) endShade.element.style.pointerEvents = "none";
      if (startShade.element) startShade.element.style.display = "none";
      if (endShade.element) endShade.element.style.display = "none";
      leftShade.current = startShade;
      rightShade.current = endShade;
      const selection = regions.addRegion({ id: "trim-selection", start: 0, end: duration, color: "rgba(255, 178, 92, .035)", drag: false, resize: true, minLength: .08 });
      region.current = selection;
      const initial = { start: 0, end: duration };
      setRange(initial);
      scheduleAnalysis(initial);
    });
    regions.on("region-update", (selection) => {
      if (selection.id !== "trim-selection") return;
      syncTrimVisuals(selection, instance.getDuration());
      setRange({ start: selection.start, end: selection.end });
    });
    regions.on("region-updated", (selection) => {
      if (selection.id !== "trim-selection") return;
      const next = { start: selection.start, end: selection.end };
      syncTrimVisuals(selection, instance.getDuration());
      setRange(next);
      scheduleAnalysis(next);
    });
  }

  async function toggleRecording() {
    if (!hasChrome() || busy) return;
    if (recording) {
      setAnalyzing(true);
      await chrome.runtime.sendMessage({ type: "STOP_RECORDING" } satisfies ExtensionMessage);
      return;
    }
    await clearSample(false);
    liveBars.current = [];
    setSampleName("Capturing active tab");
    await chrome.runtime.sendMessage({ type: "START_RECORDING" } satisfies ExtensionMessage);
    await refreshState();
  }

  async function clearSample(resetState = true) {
    waveform.current?.destroy();
    waveform.current = null;
    region.current = null;
    leftShade.current = null;
    rightShade.current = null;
    buffer.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setRange(EMPTY_RANGE);
    setAnalysis(null);
    setAnalyzing(false);
    setElapsed(0);
    setSampleName("No audio captured");
    liveBars.current = [];
    await deleteLatestRecording();
    if (resetState && hasChrome()) {
      await chrome.storage.local.set({ recordingState: EMPTY_STATE });
      setExtensionState(EMPTY_STATE);
    }
  }

  function scheduleAnalysis(next: SelectionRange) {
    if (analysisTimer.current) window.clearTimeout(analysisTimer.current);
    setAnalyzing(true);
    analysisTimer.current = window.setTimeout(() => {
      const audio = buffer.current;
      if (!audio || !worker.current) return;
      const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index).slice());
      worker.current.postMessage({ channels, sampleRate: audio.sampleRate, range: next }, channels.map((channel) => channel.buffer));
    }, 350);
  }

  function download() {
    if (!buffer.current || range.end <= range.start) return;
    const wav = exportSelectionAsWav(buffer.current, range);
    const url = URL.createObjectURL(wav);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName(sampleName)}.wav`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function togglePlayback() {
    if (!waveform.current) return;
    if (waveform.current.isPlaying()) waveform.current.pause();
    else void waveform.current.play(waveform.current.getCurrentTime());
  }

  function syncTrimVisuals(selection: Region, duration: number) {
    const start = leftShade.current;
    const end = rightShade.current;
    if (start) {
      start.setOptions({ start: 0, end: Math.max(0, selection.start) });
      if (start.element) start.element.style.display = selection.start > 0.001 ? "block" : "none";
    }
    if (end) {
      end.setOptions({ start: Math.min(duration, selection.end), end: duration });
      if (end.element) end.element.style.display = selection.end < duration - 0.001 ? "block" : "none";
    }
  }

  function drawLiveWaveform(samples: number[]) {
    const canvas = liveCanvas.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    context.clearRect(0, 0, width, height);
    const rms = Math.sqrt(samples.reduce((sum, sample) => {
      const normalized = (sample - 128) / 128;
      return sum + normalized * normalized;
    }, 0) / Math.max(1, samples.length));
    const previous = liveBars.current[liveBars.current.length - 1] ?? 0;
    const amplitude = Math.min(1, previous * 0.38 + rms * 2.8 * 0.62);
    const barStep = 5;
    const maximumBars = Math.max(1, Math.floor(width / barStep));
    liveBars.current = [...liveBars.current, amplitude].slice(-maximumBars);
    const center = height / 2;
    context.fillStyle = "#7bd6ed";
    context.shadowColor = "rgba(83, 202, 232, .22)";
    context.shadowBlur = 4;
    liveBars.current.forEach((value, index) => {
      const barHeight = Math.max(2, value * (height - 12));
      const x = width - liveBars.current.length * barStep + index * barStep;
      context.fillRect(x, center - barHeight / 2, 2, barHeight);
    });
  }

  function cleanup() {
    worker.current?.terminate();
    waveform.current?.destroy();
    if (analysisTimer.current) window.clearTimeout(analysisTimer.current);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }

  const loading = analyzing || extensionState.status === "stopping";
  const duration = hasAudio ? range.end - range.start : recording ? elapsed : 0;

  return (
    <main className="samplex">
      <header className="sample-header">
        <strong className="brand">SAMPLEX</strong>
      </header>

      <section className="instrument-stage">
        <aside className="side-control rec-side">
          <button className={`rec-action ${recording ? "active" : ""}`} onClick={toggleRecording} disabled={busy}>
            <span className="control-face">{recording ? <Square size={11} fill="currentColor" /> : <Circle size={13} />}</span>
            <span>{busy ? "WAIT" : recording ? "STOP" : "REC"}</span>
          </button>
        </aside>

        <div className="audio-core">
          <div className="file-row">
            <label className={`name-field ${hasAudio ? "editable" : ""}`}>
              <Pencil size={11} />
              <input aria-label="Sample name" value={sampleName} onChange={(event) => setSampleName(event.target.value)} disabled={!hasAudio} />
            </label>
            <button className="delete-action" onClick={() => void clearSample()} disabled={!hasAudio || recording}><Trash2 size={13} /><span>DELETE</span></button>
          </div>

          <div className="display-frame">
            <section className="wave-section" title={hasAudio ? "Drag the edge handles to trim the sample." : undefined}>
              {!hasAudio && <div className="flat-wave" />}
              {showingCapture && <canvas ref={liveCanvas} className="live-wave" />}
              <div ref={waveformElement} className={hasAudio ? "wave-ready" : "wave-ready hidden"} />
            </section>
          </div>

          <section className="analysis-line">
            <Datum loading={loading} value={analysis?.bpm ? String(Math.round(analysis.bpm)) : "…"} label="BPM" />
            <Datum loading={loading} value={analysis?.key ?? analysis?.note ?? "…"} label="KEY" />
            <Datum loading={loading} value={analysis?.frequencyHz ? String(Math.round(analysis.frequencyHz)) : "…"} label="HZ" />
            <Datum loading={loading} value={formatTime(duration)} label="LENGTH" />
          </section>

          <button className="play-action" onClick={togglePlayback} disabled={!hasAudio}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            {playing ? "PAUSE" : "PLAY"}
          </button>
        </div>
      </section>

      <footer>
        <button className="wav-action" onClick={download} disabled={!hasAudio || loading}><Download size={15} /> WAV</button>
      </footer>
    </main>
  );
}

function Datum({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return <span className={`datum datum-${label.toLowerCase()}`}>{loading ? <i className="skeleton" /> : <strong>{value}</strong>}<small>{label}</small></span>;
}
function hasChrome() { return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id); }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`; }
function safeName(value: string) { return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").trim().slice(0, 80) || "SampleX Recording"; }
