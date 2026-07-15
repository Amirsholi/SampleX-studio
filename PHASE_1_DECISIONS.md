# Phase 1 Decisions

This file tracks the product decisions needed before implementation starts.

## Current Understanding

The app is for average music producers who hear a useful sound in the browser: a sound in a video, a loop in a song, or an interesting phrase in a stream.

The user wants to obtain that sound, refine it, and use it in their own productions.

The long-term target is a browser extension.

## Recommended Starting Point

Start with a local browser prototype before the extension.

This prototype should focus on the editing workflow:

- import audio/video file;
- show waveform;
- select a region;
- loop the selected region;
- adjust trim points;
- add simple fade in/out;
- export the selected region.

The extension can come after the editor feels right.

## Decisions To Make

### 1. First Prototype Type

Options:

- Local browser app first.
- Browser extension first.

Recommendation: local browser app first.

Decision:

- Local browser app first.

### 2. First Input Method

Options:

- Upload local audio/video file.
- Record audio from active browser tab.
- Paste URL.
- Microphone/system input.

Recommendation: upload local audio/video file first, then tab capture later.

Decision:

- Upload local audio/video file first.

### 3. First Export Format

Options:

- WAV.
- MP3.
- Both.

Recommendation: WAV first.

Decision:

-

### 4. First Audio Tools

Options:

- Waveform and trim only.
- Waveform, trim, loop playback.
- Waveform, trim, loop playback, fades, gain.
- Add BPM/key detection in the first version.

Recommendation: waveform, trim, loop playback, fades, gain.

Decision:

-

### 5. First Storage Model

Options:

- No saved library, export only.
- Browser local storage for recent samples.
- Full sample library.

Recommendation: export only for MVP.

Decision:

-

### 6. Browser Target

Options:

- Chrome first.
- Edge first.
- Firefox first.
- Chrome and Edge first.

Recommendation: Chrome and Edge first.

Decision:

-

### 7. Legal/Safety UX

Options:

- Minimal notice.
- Clear first-run notice.
- Persistent source/rights metadata reminder.

Recommendation: clear first-run notice plus optional source metadata.

Decision:

-

### 8. Settings Section

The settings section is intentionally deferred.

Known future settings may include:

- export format preferences;
- default sample rate and bit depth;
- analysis options;
- browser extension capture options;
- library/storage preferences;
- legal/source metadata preferences;
- theme or interface density.

Decision:

- Defer settings until after the main screen and MVP flow are defined.

## Interface References

The user provided two interface mockups generated for this project. These are not external inspiration references; they represent the intended organization and feature direction for the app's main screen.

- Raw recorded audio state: dark interface, waveform-focused editor, selected region in blue, basic transport controls, analyze action available but not yet processed.
- Processed audio state: same waveform editor, with the lower panel changed into analysis results showing BPM, key, duration, and sample rate.

These mockups should be treated as the primary visual target for the MVP main screen.

Visual direction:

- Compact dark sampler interface.
- Product name in the top-left.
- Settings icon in the top-right.
- File selector/import area near the top.
- Download/export and delete actions in the header area.
- Large waveform as the main focus.
- Blue selected region over a grey waveform.
- Trim handles for selection start and end.
- Time ruler above waveform.
- Start, end, and length values below waveform.
- Playback controls below the timing row.
- Lower panel should change depending on state:
  - before processing: prominent analyze action;
  - after processing: analysis cards for BPM, key, duration, and sample rate;
  - recording/import action remains clearly visible.

Interaction direction:

- The first prototype should feel like a small production utility, not a full DAW.
- Most work should happen on one screen.
- The user should be able to import, trim, loop, analyze, and export without navigating away.
- The settings screen will be designed later after the missing product options are clearer.

## Phase 1 Exit Criteria

Phase 1 is complete when all decisions above have an answer.

After that, the suggested next phase is Phase 2: technical design.

## Phase 1 Status

Status: approved by user.

Approved direction:

- First build is a local browser web app.
- First input method is local audio/video file upload.
- Browser extension capture comes later.
- Main screen should follow the provided project mockups as the visual target.
- Settings section is deferred.
- MVP is focused on the main sample editing and analysis flow.
