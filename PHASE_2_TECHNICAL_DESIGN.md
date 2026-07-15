# Phase 2 Technical Design

Status: approved and implemented for MVP start.

## Product Direction From Phase 1

The MVP is a local browser web app for producers.

Primary workflow:

1. Record audio from a browser tab.
2. Display a waveform.
3. Select a region.
4. Preview the selected region as a loop.
5. Export the selected region as a WAV sample.
6. Delete/reset the recording.

The main screen should follow the provided project mockups as the visual target.

## Recommended Stack

### App Framework

Use Vite with React and TypeScript.

Reason:

- Fast local development.
- Good browser audio ecosystem support.
- Easy future migration of the editor UI into an extension page.
- TypeScript helps keep audio state and timing logic safer.

### Styling

Use plain CSS modules or a single scoped stylesheet for the MVP.

Reason:

- The interface is custom and compact.
- The mockup has a specific dark visual language.
- Avoids bringing in a large UI framework before the design system is known.

Recommendation: plain CSS for the MVP.

### Waveform

Use WaveSurfer.js.

Reason:

- Reliable waveform rendering.
- Region selection support through plugins.
- Good fit for trim and loop workflows.

### Audio Processing

Use Web Audio API for decoding, trimming, gain, fade, and WAV export.

Reason:

- Runs locally in the browser.
- Keeps MVP private and offline-friendly.
- Reusable later for the extension.

### Tab Audio Recording

For the web app MVP, use `navigator.mediaDevices.getDisplayMedia()` with audio enabled.

Important limitation:

- A normal web app cannot silently capture the active tab.
- The browser will show a capture picker.
- The user must select the tab/source and enable tab audio sharing.
- Browser support for audio capture varies, so Chrome and Edge are the first targets.

Implementation direction:

1. Request display/tab capture with audio.
2. Use `MediaRecorder` to record the returned `MediaStream`.
3. Store recorded chunks as a Blob.
4. Decode the recorded audio into an `AudioBuffer`.
5. Render the decoded audio in the waveform editor.
6. Export the selected region by slicing the `AudioBuffer` and encoding it as WAV.

Future extension direction:

- Use `chrome.tabCapture` after an explicit extension action click.
- This should reduce friction compared with the web app capture picker.

### Analysis

Advanced analysis is deferred for the MVP.

The UI can keep the lower analysis area from the mockup, but the first implementation should focus on capture and sample extraction. BPM/key should not be displayed as real values until implemented with a reliable method.

### Export

Start with WAV export.

Reason:

- Browser-side WAV encoding is straightforward.
- Producers expect WAV as a production-safe format.
- MP3 requires extra encoding dependency and licensing/runtime considerations.

### Persistence

No sample library in MVP.

Use in-memory state only, plus downloaded exports.

### Browser Target

Chrome and Edge first.

Reason:

- Best future path for Manifest V3 extension APIs.
- Easier tab capture path later.

## Proposed Project Structure

```text
src/
  app/
    App.tsx
    App.css
  audio/
    decodeAudio.ts
    exportWav.ts
    analyzeSelection.ts
    selectionBuffer.ts
  components/
    Header.tsx
    WaveformEditor.tsx
    TransportControls.tsx
    TimingPanel.tsx
    AnalysisPanel.tsx
    RecordBar.tsx
  types/
    audio.ts
```

## MVP Functional Scope

Must have:

- Record audio from a browser tab through browser capture permission.
- Waveform rendering.
- Selection region.
- Play/pause.
- Loop selected region.
- Display start, end, and length.
- Export selected region as WAV.
- Delete/reset recording.

Nice to have:

- Zoom controls.
- Recording timer.
- Empty state that explains how to select a tab and enable tab audio.
- Analysis panel shell matching the mockup, without advanced analysis yet.

Deferred:

- Browser extension.
- Settings screen.
- Sample library.
- MP3 export.
- Advanced BPM/key detection.
- Gain/fade tools.
- Local file upload, unless needed as a fallback for capture testing.

## Phase 2 Decisions Needed

### 1. Framework

Recommendation: Vite + React + TypeScript.

Decision:

- Vite + React + TypeScript.

### 2. Waveform Library

Recommendation: WaveSurfer.js.

Decision:

- WaveSurfer.js.

### 3. First Export Format

Recommendation: WAV only.

Decision:

- WAV only.

### 4. Analysis Depth

Recommendation: defer BPM/key and advanced analysis. Focus on capture, waveform, selection, loop playback, WAV export, and deletion.

Decision:

- Advanced analysis deferred for MVP.

### 5. MVP Audio Tools

Recommendation: tab recording, waveform, trim/selection, loop playback, WAV export, and delete/reset.

Decision:

- Tab recording, waveform, region selection/trim, loop playback, WAV export, and delete/reset only.

## Phase 2 Exit Criteria

Phase 2 is complete when:

- stack is approved;
- waveform library is approved;
- export format is approved;
- analysis scope is approved;
- MVP feature list is approved.

After that, the suggested next phase is Phase 3: MVP implementation.

## Phase 2 Status

Status: approved by user.

Approved MVP:

- Record audio from a browser tab.
- Show waveform.
- Select/trim a region.
- Play the selected region in loop.
- Export the trimmed selection as WAV.
- Delete/reset the recording.

Legitimate extension direction:

- The final browser extension should use explicit user action, clear permissions, and normal store-compliant browser APIs.
- It must not bypass DRM, platform restrictions, or permission prompts.
- The web app MVP uses `getDisplayMedia()` as a legitimate browser permission flow before the extension phase.
