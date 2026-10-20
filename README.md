# SampleX Studio

A Chrome extension for recording tab audio, selecting a useful fragment, estimating its musical characteristics and exporting it as a WAV sample.

**[Product page and demo](https://amirsholi.vercel.app/samplex)** · **[Demo release](https://github.com/Amirsholi/SampleX-studio/releases/tag/v0.3.0-demo)**

Built by [Amir Sholi](https://github.com/Amirsholi) as a personal software project.

## Workflow

1. Open SampleX on a supported browser tab and start recording.
2. Watch the live waveform while audio is captured.
3. Stop, select a region and preview the fragment.
4. Analyze the selection for estimated BPM, musical key and frequency.
5. Export the selected region as a WAV file.

Recording, editing and audio analysis run locally in the browser. The demo includes 75 WAV exports.

## Technical stack

- **React 19 and TypeScript:** editor UI, application state and typed extension messages.
- **Vite:** development server and multi-entry extension build.
- **Chrome Manifest V3:** service worker, tab capture and an offscreen document.
- **Web Audio API / AudioWorklet:** PCM capture and live waveform data, with a MediaRecorder fallback.
- **WaveSurfer.js:** waveform display, playback and region selection.
- **Web Workers:** audio analysis and WAV processing outside the UI thread.
- **IndexedDB:** local recording storage.
- **Vitest:** automated tests for audio analysis and WAV encoding.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/App.tsx` | Recording controls, waveform interaction, selection, analysis and export |
| `src/extension/background.ts` | Coordinates extension actions and capture |
| `src/extension/panelHost.ts` | Hosts the SampleX panel on the browser page |
| `src/extension/offscreen.ts` | Captures tab audio and sends live waveform updates |
| `src/audio/recordingStore.ts` | Persists the latest recording locally in IndexedDB |
| `src/audio/analysis.worker.ts` | Receives audio and processes analysis/export requests |
| `src/audio/analyzeSelection.ts` | Estimates tempo, pitch/key, frequency and channel characteristics |
| `src/audio/exportWav.ts` | Encodes selected audio as 16-bit PCM WAV |
| `src/audio/pcmFinalize.worker.ts` | Finalizes PCM recording data |
| `src/license/` | Local export credits and license verification |

WAV export includes short fades, a search for nearby zero crossings, DC-offset removal and dithering. These processing steps are intended to reduce boundary clicks and quantization artifacts.

## Try the demo

Requires Chrome 116 or newer.

1. Download the ZIP from the [demo release](https://github.com/Amirsholi/SampleX-studio/releases/tag/v0.3.0-demo).
2. Extract it.
3. Open `chrome://extensions` and enable Developer mode.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Pin SampleX, open a supported tab with audio, and press **REC**.

Chrome does not install the ZIP directly. See [DEMO-README.txt](DEMO-README.txt) for Spanish installation instructions.

## Develop locally

Use a Node.js version compatible with Vite 6 and npm.

```sh
npm ci
npm run dev
```

The development page previews the editor. Browser-extension capture requires loading the built extension:

```sh
npm run build
```

Load the generated `dist/` directory through Chrome's **Load unpacked** control.

## Validation

```sh
npm test
npm run build
```

The build performs TypeScript checking before bundling. Existing tests exercise audio-analysis baselines and WAV encoding/processing. They do not replace end-to-end testing of Chrome tab capture.

## Limitations

- BPM, key and frequency are **estimates**, not guaranteed musical annotations. Short, noisy, harmonically complex or rhythmically ambiguous recordings can produce uncertain results.
- Chrome internal pages and other restricted pages cannot host the extension panel.
- The browser preview does not provide the complete extension capture environment.
- Capture audio only when you have permission to do so.

## Project links

- [Product walkthrough and download](https://amirsholi.vercel.app/samplex)
- [Privacy information](CHROME_WEB_STORE_PRIVACY.md)
- [Roadmap](ROADMAP.md)
- [Author portfolio](https://amirsholi.vercel.app/)

Public source availability does not itself grant an open-source license; no open-source license is declared in this README.

