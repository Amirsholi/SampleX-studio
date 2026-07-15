# Browser Sample Analyzer Roadmap

## Vision

Browser Sample Analyzer is a browser-based tool for producers who hear an interesting sound online and want to turn it into a usable production sample.

The product should help the user capture or import audio, isolate a useful fragment, loop it, refine it, and export it for use in a DAW.

The project should support legitimate use cases only: user-owned material, licensed material, public-domain or royalty-free sources, and sources where the user has permission to sample.

## Phase Policy

We work one phase at a time.

The user decides when a phase is complete. Development only moves to the next phase after explicit approval.

## Phase 1: Product Definition

Goal: define the first usable version before choosing the final technical architecture.

Key decisions:

- Initial product shape: local browser prototype or browser extension first.
- Primary input: local file upload, tab audio capture, microphone/system capture, or URL-based workflow.
- Core user flow: capture/import, trim, loop, refine, export.
- First export formats: WAV, MP3, or both.
- First analysis features: waveform only, BPM detection, pitch/key detection, transient detection, loudness normalization.
- Storage model: no persistence, local session, browser storage, or local sample library.
- Legal/safety posture: how visibly the app communicates rights and user responsibility.

Recommended MVP:

1. A local browser prototype that accepts audio/video files.
2. A waveform editor with trim handles.
3. Loop playback for the selected region.
4. Basic gain control and fade in/out.
5. Export selected region as WAV.
6. Metadata fields for source, timestamp, notes, and tags.

Why this MVP:

- It validates the producer workflow quickly.
- It avoids browser-extension capture limits at the start.
- It gives us reusable audio-editing code for the later extension.
- It lets the user send references and adjust the experience before we invest in extension plumbing.

Exit criteria:

- The MVP scope is approved.
- The first platform is chosen.
- The first input method is chosen.
- The first export format is chosen.
- The first analysis features are chosen.

## Phase 2: Technical Design

Goal: select stack, architecture, and project structure.

Likely topics:

- Extension manifest version and browser target.
- Frontend stack.
- Audio processing APIs and libraries.
- File/export pipeline.
- Test strategy.
- Privacy and permission model.

## Phase 3: MVP Implementation

Goal: build the first working prototype.

Likely deliverable:

- Open a local web app.
- Load an audio/video file.
- View waveform.
- Select a segment.
- Loop preview.
- Export WAV.

## Phase 4: Extension Prototype

Goal: connect the browser workflow to real tab audio capture, within platform limits.

Likely deliverable:

- Extension toolbar popup.
- Explicit user-triggered capture.
- Short audio recording from a browser tab where supported.
- Send captured audio into the sample editor.

## Phase 5: Producer Tools

Goal: improve sample usefulness for music production.

Possible features:

- BPM estimation.
- Pitch/key estimation.
- Beat or transient markers.
- Snap-to-zero-crossing trim.
- Normalize loudness.
- Fades.
- One-shot vs loop mode.
- Export naming presets.

## Phase 6: Library and Export

Goal: help users organize and reuse samples.

Possible features:

- Local sample library.
- Tags and notes.
- Source metadata.
- Export WAV/MP3/FLAC.
- Batch export.
- Project/session save.

## Phase 7: QA and Packaging

Goal: make the app reliable enough to use repeatedly.

Possible deliverables:

- Browser compatibility checks.
- Extension packaging.
- Documentation.
- Test sample set.
- Manual QA checklist.
