import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Circle, Download, KeyRound, Pause, Pencil, Play, RotateCcw, SkipBack, Square, Trash2, X } from "lucide-react";
import { decodeAudioBlob } from "./audio/decodeAudio";
import { exportSelectionAsWav } from "./audio/exportWav";
import { deleteLatestRecording, getLatestRecording } from "./audio/recordingStore";
import type { ExtensionMessage, ExtensionState } from "./extension/messages";
import type { AnalysisResult, SelectionRange } from "./types";
import { activateLicense, consumeExport, FREE_EXPORTS, getAccessState, LICENSE_URL, restoreLicense, shortLicenseId, type AccessState } from "./license/license";

const EMPTY_RANGE = { start: 0, end: 0 };
const EMPTY_STATE: ExtensionState = { status: "idle" };
const SESSION_KEY = "samplexEditingSession";

interface EditingSession {
  recordingCreatedAt: number;
  range: SelectionRange;
  sampleName: string;
}

export default function App() {
  const waveformElement = useRef<HTMLDivElement | null>(null);
  const waveSection = useRef<HTMLElement | null>(null);
  const liveCanvas = useRef<HTMLCanvasElement | null>(null);
  const waveform = useRef<WaveSurfer | null>(null);
  const region = useRef<Region | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const worker = useRef<Worker | null>(null);
  const analysisTimer = useRef<number | null>(null);
  const objectUrl = useRef<string | null>(null);
  const liveBars = useRef<number[]>([]);
  const activeRange = useRef<SelectionRange>(EMPTY_RANGE);
  const recordingCreatedAt = useRef<number | null>(null);
  const currentSampleName = useRef("No audio captured");
  const [extensionState, setExtensionState] = useState<ExtensionState>(EMPTY_STATE);
  const [sampleName, setSampleName] = useState("No audio captured");
  const [range, setRange] = useState<SelectionRange>(EMPTY_RANGE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hoverPlayhead, setHoverPlayhead] = useState<number | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({ credits: FREE_EXPORTS, unlocked: false });
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseCode, setLicenseCode] = useState("");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState<string | null>(null);
  const [pendingExport, setPendingExport] = useState(false);

  const recording = extensionState.status === "recording";
  const showingCapture = recording || extensionState.status === "stopping";
  const busy = extensionState.status === "starting" || extensionState.status === "stopping";
  const hasAudio = Boolean(buffer.current && objectUrl.current);

  useEffect(() => { activeRange.current = range; }, [range]);
  useEffect(() => { currentSampleName.current = sampleName; }, [sampleName]);

  useEffect(() => {
    worker.current = new Worker(new URL("./audio/analysis.worker.ts", import.meta.url), { type: "module" });
    worker.current.onmessage = (event: MessageEvent<AnalysisResult>) => {
      setAnalysis(event.data);
      setAnalyzing(false);
    };
    if (hasChrome()) {
      void refreshState();
      void refreshAccess();
      const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
        const next = changes.recordingState?.newValue as ExtensionState | undefined;
        if (next) {
          setExtensionState(next);
          setUiError(next.status === "error" ? next.error ?? "SampleX encountered an error." : null);
          if (next.status === "ready") void loadRecording();
        }
        if (changes.samplexExportCredits || changes.samplexLicense || changes.samplexRedeemedLicenses) void refreshAccess();
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
    try {
      const next = await chrome.runtime.sendMessage({ type: "GET_STATE" } satisfies ExtensionMessage) as ExtensionState;
      setExtensionState(next);
      setUiError(next.status === "error" ? next.error ?? "SampleX encountered an error." : null);
      if (next.status === "ready") await loadRecording();
    } catch (error) {
      setUiError(errorMessage(error));
    }
  }

  async function refreshAccess() {
    setAccess(await getAccessState());
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
    recordingCreatedAt.current = stored.createdAt;
    const saved = hasChrome() ? (await chrome.storage.local.get(SESSION_KEY))[SESSION_KEY] as EditingSession | undefined : undefined;
    const restored = saved?.recordingCreatedAt === stored.createdAt ? saved : undefined;
    const loadedName = buildEditableName(restored?.sampleName || stored.sourceTitle || "Untitled sample");
    currentSampleName.current = loadedName;
    setSampleName(loadedName);
    setElapsed(decoded.duration);
    mountWaveform(url, restored?.range);
  }

  function mountWaveform(url: string, restoredRange?: SelectionRange) {
    if (!waveformElement.current) return;
    const regions = RegionsPlugin.create();
    const instance = WaveSurfer.create({
      container: waveformElement.current,
      url,
      height: 111,
      waveColor: ["#53616b", "#aab8bf", "#667681"],
      progressColor: ["#91bac5", "#e7f2f4", "#70bfd0"],
      cursorColor: "#ffd7a3",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 0,
      normalize: true,
      interact: false,
      plugins: [regions],
    });
    waveform.current = instance;
    instance.on("play", () => setPlaying(true));
    instance.on("pause", () => setPlaying(false));
    instance.on("finish", () => {
      setPlaying(false);
      instance.setTime(activeRange.current.start);
    });
    instance.on("timeupdate", (currentTime) => {
      const selection = activeRange.current;
      if (selection.end <= selection.start || currentTime < selection.end - .01) return;
      instance.pause();
      instance.setTime(selection.start);
      setPlaying(false);
    });
    instance.on("ready", () => {
      const duration = instance.getDuration();
      const restoredStart = Math.max(0, Math.min(restoredRange?.start ?? 0, Math.max(0, duration - .08)));
      const restoredEnd = Math.max(restoredStart + .08, Math.min(restoredRange?.end ?? duration, duration));
      const selection = regions.addRegion({ id: "trim-selection", start: restoredStart, end: restoredEnd, color: "transparent", drag: false, resize: true, minLength: .08 });
      region.current = selection;
      const initial = { start: restoredStart, end: restoredEnd };
      activeRange.current = initial;
      setRange(initial);
      instance.setTime(initial.start);
      scheduleAnalysis(initial);
    });
    regions.on("region-update", (selection) => {
      if (selection.id !== "trim-selection") return;
      const next = { start: selection.start, end: selection.end };
      activeRange.current = next;
      setRange(next);
    });
    regions.on("region-updated", (selection) => {
      if (selection.id !== "trim-selection") return;
      const next = { start: selection.start, end: selection.end };
      activeRange.current = next;
      setRange(next);
      instance.setTime(next.start);
      if (instance.isPlaying()) void instance.play(next.start);
      void persistEditingSession(next, currentSampleName.current);
      scheduleAnalysis(next);
    });
  }

  async function toggleRecording() {
    if (!hasChrome() || busy) return;
    setUiError(null);
    try {
      if (recording) {
        setAnalyzing(true);
        const response = await chrome.runtime.sendMessage({ type: "STOP_RECORDING" } satisfies ExtensionMessage) as { ok?: boolean; error?: string };
        if (response?.ok === false) throw new Error(response.error ?? "Recording could not stop.");
        return;
      }
      await clearSample(false);
      liveBars.current = [];
      setSampleName("Capturing active tab");
      const response = await chrome.runtime.sendMessage({ type: "START_RECORDING" } satisfies ExtensionMessage) as { ok?: boolean; error?: string };
      if (response?.ok === false) throw new Error(response.error ?? "Recording could not start.");
      await refreshState();
    } catch (error) {
      setAnalyzing(false);
      setUiError(errorMessage(error));
      await refreshState();
    }
  }

  async function clearSample(resetState = true) {
    waveform.current?.destroy();
    waveform.current = null;
    region.current = null;
    recordingCreatedAt.current = null;
    buffer.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setRange(EMPTY_RANGE);
    setAnalysis(null);
    setAnalyzing(false);
    setElapsed(0);
    currentSampleName.current = "No audio captured";
    setSampleName("No audio captured");
    liveBars.current = [];
    await deleteLatestRecording();
    if (hasChrome()) await chrome.storage.local.remove(SESSION_KEY);
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

  async function download(accessOverride?: AccessState) {
    if (!buffer.current || range.end <= range.start) return;
    const currentAccess = accessOverride ?? access;
    if (!currentAccess.unlocked && currentAccess.credits <= 0) {
      setPendingExport(true);
      setLicenseOpen(true);
      return;
    }
    try {
      const wav = exportSelectionAsWav(buffer.current, range);
      const nextAccess = currentAccess.unlocked ? currentAccess : await consumeExport();
      const url = URL.createObjectURL(wav);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildDownloadName(sampleName, analysis);
      anchor.click();
      setAccess(nextAccess);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setUiError(errorMessage(error));
    }
  }

  async function submitLicense(event: React.FormEvent) {
    event.preventDefault();
    if (!licenseCode.trim() || licenseBusy) return;
    setLicenseBusy(true);
    setLicenseMessage(null);
    try {
      const next = await activateLicense(licenseCode);
      setAccess(next);
      setLicenseCode("");
      setLicenseMessage("SampleX is permanently unlocked.");
      if (pendingExport) {
        setPendingExport(false);
        setLicenseOpen(false);
        await download(next);
      }
    } catch (error) {
      setLicenseMessage(errorMessage(error));
    } finally {
      setLicenseBusy(false);
    }
  }

  async function handleRestore() {
    setLicenseBusy(true);
    setLicenseMessage(null);
    try {
      const next = await restoreLicense();
      setAccess(next);
      setLicenseMessage(next.unlocked ? "License restored." : "No permanent license was found in Chrome Sync.");
    } finally {
      setLicenseBusy(false);
    }
  }

  function closeLicense() {
    setLicenseOpen(false);
    setPendingExport(false);
  }

  function togglePlayback() {
    if (!waveform.current) return;
    if (waveform.current.isPlaying()) waveform.current.pause();
    else {
      const currentTime = waveform.current.getCurrentTime();
      const startTime = currentTime < range.start || currentTime >= range.end ? range.start : currentTime;
      waveform.current.setTime(startTime);
      void waveform.current.play(startTime);
    }
  }

  function restartSelection() {
    if (!waveform.current) return;
    const wasPlaying = waveform.current.isPlaying();
    waveform.current.setTime(range.start);
    if (wasPlaying) void waveform.current.play(range.start);
  }

  async function persistEditingSession(nextRange: SelectionRange, nextName: string) {
    if (!hasChrome() || recordingCreatedAt.current === null) return;
    const session: EditingSession = { recordingCreatedAt: recordingCreatedAt.current, range: nextRange, sampleName: nextName };
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }

  function renameSample(nextName: string) {
    currentSampleName.current = nextName;
    setSampleName(nextName);
    void persistEditingSession(activeRange.current, nextName);
  }

  function wavePosition(clientX: number) {
    const element = waveSection.current;
    if (!element) return 0;
    const bounds = element.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
  }

  function isTrimControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[part*="region-handle"]'));
  }

  function previewPlayhead(event: React.PointerEvent<HTMLElement>) {
    if (!hasAudio || isTrimControl(event.target)) return;
    setHoverPlayhead(wavePosition(event.clientX) * 100);
  }

  function commitPlayhead(event: React.MouseEvent<HTMLElement>) {
    if (!hasAudio || !waveform.current || isTrimControl(event.target)) return;
    const nextTime = wavePosition(event.clientX) * waveform.current.getDuration();
    waveform.current.setTime(nextTime);
    setHoverPlayhead(null);
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
  const sourceDuration = buffer.current?.duration ?? 0;
  const trimStart = sourceDuration ? (range.start / sourceDuration) * 100 : 0;
  const trimEnd = sourceDuration ? (range.end / sourceDuration) * 100 : 100;

  return (
    <main className="samplex">
      <header className="sample-header">
        <strong className="brand">SAMPLEX</strong>
        <div className="license-controls">
          <button className="license-button" type="button" onClick={() => setLicenseOpen(true)} aria-label="License settings" title="License settings"><KeyRound size={12} /></button>
        </div>
        {uiError && <span className="error-toast" role="alert" title={uiError}>{uiError}</span>}
      </header>

      <section className="instrument-stage">
        <aside className="side-control rec-side">
          <div className="rec-stack">
            <button className={`rec-action ${recording ? "active" : ""}`} onClick={toggleRecording} disabled={busy}>
              <span className="control-face">{recording ? <Square size={11} fill="currentColor" /> : <Circle size={13} />}</span>
              <span>{busy ? "WAIT" : recording ? "STOP" : "REC"}</span>
            </button>
            <button className="credit-display" data-level={creditLevel(access)} type="button" onClick={() => setLicenseOpen(true)} aria-label={access.unlocked ? "Permanent license active" : `${access.credits} exports remaining`} title={access.unlocked ? "Permanent license" : `${access.credits} exports remaining`}>
              {access.unlocked ? "∞" : String(access.credits).padStart(2, "0")}
            </button>
          </div>
        </aside>

        <div className="audio-core">
          <div className="file-row">
            <label className={`name-field ${hasAudio ? "editable" : ""}`}>
              <Pencil size={11} />
              <input aria-label="Sample name" value={sampleName} onChange={(event) => renameSample(event.target.value)} disabled={!hasAudio} />
            </label>
            <button className="delete-action" onClick={() => void clearSample()} disabled={!hasAudio || recording}><Trash2 size={13} /><span>DELETE</span></button>
          </div>

          <div className="display-frame">
            <section ref={waveSection} className="wave-section" title={hasAudio ? "Drag the brackets to trim. Hover to preview a position and click to place the playhead." : undefined} onPointerMove={previewPlayhead} onPointerLeave={() => setHoverPlayhead(null)} onClick={commitPlayhead}>
              {!hasAudio && <div className="flat-wave" />}
              {showingCapture && <canvas ref={liveCanvas} className="live-wave" />}
              <div ref={waveformElement} className={hasAudio ? "wave-ready" : "wave-ready hidden"} />
              {hasAudio && <>
                <span className="trim-mask trim-mask-left" style={{ width: `${trimStart}%` }} />
                <span className="trim-mask trim-mask-right" style={{ left: `${trimEnd}%` }} />
                <span className="trim-bracket trim-bracket-left" style={{ left: `${trimStart}%` }} />
                <span className="trim-bracket trim-bracket-right" style={{ left: `${trimEnd}%` }} />
                {hoverPlayhead !== null && <span className="hover-playhead" style={{ left: `${hoverPlayhead}%` }} />}
              </>}
            </section>
          </div>

          <section className="analysis-line">
            <Datum loading={loading} value={analysis?.bpm ? String(Math.round(analysis.bpm)) : "…"} label="BPM" />
            <Datum loading={loading} value={analysis?.key ?? analysis?.note ?? "…"} label="KEY" />
            <Datum loading={loading} value={analysis?.frequencyHz ? String(Math.round(analysis.frequencyHz)) : "…"} label="HZ" />
            <Datum loading={loading} value={formatTime(duration)} label="LENGTH" />
          </section>

          <button className="play-action" onClick={togglePlayback} disabled={!hasAudio} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
          </button>
          <button className="restart-action" onClick={restartSelection} disabled={!hasAudio} aria-label="Return to trim start" title="Return to trim start">
            <SkipBack size={16} fill="currentColor" />
          </button>
        </div>
      </section>

      <footer>
        <button className="wav-action" onClick={() => void download()} disabled={!hasAudio || loading} aria-label="Download WAV" title="Download WAV"><Download size={17} /></button>
      </footer>

      {licenseOpen && (
        <LicensePanel access={access} code={licenseCode} busy={licenseBusy} message={licenseMessage} onClose={closeLicense} onCode={setLicenseCode} onSubmit={submitLicense} onRestore={handleRestore} />
      )}
    </main>
  );
}

interface LicenseUiProps {
  code: string;
  busy: boolean;
  message: string | null;
  onCode: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function ActivationForm({ code, busy, message, onCode, onSubmit }: LicenseUiProps) {
  return (
    <div className="activation-card">
      <KeyRound size={18} />
      <form onSubmit={onSubmit}>
        <input value={code} onChange={(event) => onCode(event.target.value)} placeholder="SAMPLEX LICENSE" aria-label="SampleX license code" autoComplete="off" spellCheck={false} />
        <button type="submit" disabled={busy || !code.trim()}>{busy ? "CHECKING" : "ACTIVATE"}</button>
      </form>
      {message && <p role="status">{message}</p>}
      <a href={LICENSE_URL} target="_blank" rel="noreferrer">GET LICENSE</a>
    </div>
  );
}

function LicensePanel({ access, code, busy, message, onClose, onCode, onSubmit, onRestore }: LicenseUiProps & { access: AccessState; onClose: () => void; onRestore: () => void }) {
  return (
    <div className="license-panel-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="license-panel" role="dialog" aria-modal="true" aria-labelledby="license-title">
        <button className="license-close" type="button" onClick={onClose} aria-label="Close license settings"><X size={14} /></button>
        <span className="license-kicker">LICENSE</span>
        <strong id="license-title">{access.unlocked ? "PERMANENT" : `${access.credits} EXPORTS`}</strong>
        <small>{shortLicenseId(access.licenseId)}</small>
        <ActivationForm code={code} busy={busy} message={message} onCode={onCode} onSubmit={onSubmit} />
        <button className="restore-button" type="button" onClick={onRestore} disabled={busy}><RotateCcw size={11} /> RESTORE</button>
      </section>
    </div>
  );
}

function Datum({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return <span className={`datum datum-${label.toLowerCase()}`}>{loading ? <i className="skeleton" /> : <strong>{value}</strong>}<small>{label}</small></span>;
}
function hasChrome() { return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
function creditLevel(access: AccessState) {
  if (access.unlocked) return "unlocked";
  if (access.credits <= 0) return "empty";
  if (access.credits <= 10) return "low";
  return "normal";
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`; }
function safeName(value: string) { return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").trim().slice(0, 80) || "SampleX Recording"; }
function buildEditableName(value: string) {
  return safeName(value)
    .replace(/\s*[-|]\s*YouTube\s*$/i, "")
    .replace(/\s*\((official\s+)?(music\s+)?video\)\s*/ig, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim() || "samplex";
}
function buildDownloadName(value: string, analysis: AnalysisResult | null) {
  const base = buildEditableName(value);
  const bpm = analysis?.bpm ? `${Math.round(analysis.bpm)}bpm` : "";
  const key = analysis?.key ?? analysis?.note ?? "";
  const keyToken = key.replace(/#/g, "sharp").replace(/♭/g, "flat").replace(/\s+/g, "-").toLowerCase();
  return `${safeName([base, bpm, keyToken].filter(Boolean).join("_"))}.wav`;
}
