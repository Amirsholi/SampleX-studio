# Phase 3 MVP Implementation

Status: in progress.

## Implemented

- Vite + React + TypeScript app.
- Dark single-screen SampleX Studio interface based on the provided project mockups.
- Browser tab audio recording flow using `getDisplayMedia()` and `MediaRecorder`.
- Audio-only recording stream extraction from shared tab audio.
- Recorded Blob decoding into `AudioBuffer`.
- WaveSurfer waveform rendering.
- Region selection and resizing.
- Selection loop playback.
- WAV export from the selected `AudioBuffer` range.
- Delete/reset recording.
- Build verification.
- Initial design QA report.

## Phase 3.1 Corrections

Implemented after first manual test:

- Editable sample title in the header row.
- WAV export now uses the edited sample title as the downloaded filename.
- Main time displays now use `00:00` format.
- Drag preview keeps millisecond precision only while adjusting selection.
- Selection defaults to the full recorded waveform.
- Clicking the selected region moves the playhead to the selection start instead of immediately playing.
- Start, end, and length readouts are more compact.
- Waveform rendering is denser and closer to the supplied reference.
- Region handles are visually emphasized.
- Areas outside the selected region are darkened.
- Zoom range is stronger and WaveSurfer's scrollbar is hidden.
- Loop toggle no longer rebuilds the waveform or resets the selection.

## Phase 3.2 Waveform UX Direction

Implemented after second manual review:

- Returned the visual composition closer to the first two project mockups.
- Start, end, and length are now compact floating readouts attached to the waveform instead of large tab-like blocks.
- Region dragging is disabled; only start/end handles should define the selection. This avoids accidental movement of the whole selected range.
- Waveform density was reduced for a more audio-tool/VST-like feel.
- Zoom changes now animate over a short eased transition.
- Added a live waveform canvas while recording so the user sees incoming audio activity before the final decoded WaveSurfer waveform is generated.
- Recording a new take clears the previous sample first so the live waveform can occupy the waveform area.

Quality direction:

- The waveform editor must feel like a serious audio tool, not like a generic web selection widget.
- Future changes should be judged by whether they would feel acceptable in a high-quality VST-style audio workflow.

## Phase 3.3 Dual-Region Waveform Model

Implemented after clarifying the intended editor behavior:

- The waveform represents the full recorded audio.
- The blue region is now the internal analysis selection.
  - It can be dragged as a whole.
  - It does not darken the rest of the waveform.
  - Clicking it moves the playhead to the start of the analysis region.
  - It is reserved for future BPM, key, and frequency analysis.
- The crop/export region is separate from the blue analysis region.
  - It defaults to the full audio duration.
  - Its start/end handles define what gets played, looped, and exported as WAV.
  - Audio before crop start and after crop end is darkened.
  - Start, end, and length now describe this crop/export region.
- Start, end, and length were moved below the waveform frame as simple text and numbers with no capsule outline.

Known current limitation:

- The web app still uses the browser's `getDisplayMedia()` flow, so it will keep showing browser permission and sharing UI. This cannot be removed until the extension phase.

## Phase 3.4 Prior Prompt Completion

Implemented after follow-up review:

- Timeline ticks are now rendered only after a final recorded waveform exists.
- During recording, the waveform frame shows a live spectrum-style visualizer with no timeline.
- Recording state now uses a compact central caption with elapsed time.
- Overall UI was tightened toward the original compact mockup: smaller header, file row, transport, record bar, and panel heights.
- Start, end, and length remain below the waveform frame as text-only readouts.

Still intentionally deferred:

- Removing the browser permission prompt and `127.0.0.1` sharing indicator is not possible in the web app prototype. This belongs to the extension phase.

## Phase 3.5 Editor Interaction Fixes

Implemented after waveform usability review:

- Live recording visualizer is now centered and uses a spectrum-style display.
- Added a moving background scan light inspired by the "Knight Rider" / "Supercar" light effect.
- Waveform color changed from blue to neutral steel/gray so it does not compete with selection colors.
- Analysis region changed to a green/cyan accent to separate it from the waveform and playback UI.
- Fixed the analysis region drag issue by lowering the crop region layer; the transparent crop region should no longer block dragging the analysis region.
- Added a hover playhead preview that follows the pointer without changing playback.
- Clicking the waveform confirms the hover playhead position and moves the actual playhead there.
- Disabled WaveSurfer's default click-to-seek behavior so silent hover preview and click confirmation are controlled by our UI.
- Removed external crop marker overlays that desynced during zoom; crop visuals now rely on WaveSurfer's region layer so markers should stay aligned when zoom changes.

Still needs manual validation:

- Dragging the analysis region over a recorded waveform.
- Crop handle precision after zoom.
- Hover playhead behavior over a real recorded waveform.

## Phase 3.6 Plugin Identity Pass

Implemented from the latest visual references:

- Enlarged the waveform / recording visualization window vertically and horizontally.
- Rebuilt the live recording visualizer as a centered waveform-like signal line inspired by reference image 1.
- Added a subtle blue sonar/radar grid and a horizontal scanning light behind the live signal.
- Changed final waveform color toward white/steel so it reads separately from the analysis region.
- Kept the analysis region in green/cyan so it does not compete with the waveform or blue playback accents.
- Made crop handles/region edges brighter white and more visible.
- Fixed click-to-confirm playhead positioning to use the exact click event, including clicks on the analysis region.
- Changed the transport side buttons from reset-style control to crop start/end jumps: `|<` and `>|`.
- Added an Analyze Selection card with music, waveform, and frequency-style icons for the future BPM/key/Hz analysis action.
- Duration placeholder now uses `00:00`.

Still needs manual validation:

- Confirm click-to-position works over the white waveform area and over the analysis region.
- Confirm crop handles stay aligned after zoom on a real recording.
- Confirm the live recording visualizer feels subtle enough while recording real audio.

## Phase 4 Audio Analysis

Status: initial implementation complete.

Implemented:

- `Analyze Selection` now runs on the green/cyan analysis region.
- Added browser-side BPM estimation using frame energy and onset autocorrelation.
- Added dominant frequency estimation using autocorrelation.
- Added estimated musical key using pitch-class histogram matching.
- Added confidence percentage.
- Results panel now includes Duration, Sample Rate, BPM, Key, Hz, and Confidence.

Important note:

- These are first-pass local estimates. BPM/key detection is inherently approximate and needs calibration with real samples before treating results as production-grade.

Manual validation needed:

- Analyze drum loops with known BPM.
- Analyze tonal samples with known key.
- Compare Hz output against simple sine/test tones or tuner references.
- Decide whether to keep improving the in-house analyzer or move to a specialized analysis library.

Final polish before moving on:

- Slowed down the live radar/sonar sweep substantially.
- Reduced live signal glow so the recording state feels like it is gathering information rather than alerting.

## Phase 4 Extension MVP

Status: implemented; manual Chrome validation required.

- Converted the project to a Chrome Manifest V3 extension.
- Added a compact toolbar popup with only REC, STOP, timer, and capture state.
- Replaced `getDisplayMedia()` with `chrome.tabCapture` for active-tab audio capture.
- Recording continues in an offscreen document after the popup closes.
- Stopping saves the recording locally in IndexedDB and opens the editor automatically.
- Simplified the editor to one region used for playback, loop, analysis, and WAV export.
- Editor displays BPM, key/note, fundamental Hz, mono/stereo, and trimmed duration.
- Analysis runs in a Web Worker after recording and 400 ms after trim handles are released.
- Removed the separate analysis region and secondary production controls from the extension editor.

Manual checks still required:

- Load `dist` as an unpacked extension in Chrome 116 or newer.
- Record audible audio from the active tab and verify it remains audible during capture.
- Close the popup during recording, reopen it, and verify the timer/state persists.
- Stop and confirm the editor opens with the complete recording.
- Validate BPM/key/Hz against known test material.
- Verify mono/stereo classification with true mono, dual-mono, and stereo sources.

### Phase 4.1 Usability corrections

- The editor is now injected as a modal overlay on the recorded web page instead of opening a new browser tab.
- Added an editable sample name; the value is used for the WAV filename.
- Added explicit close and discard controls for the modal.
- Frequency results now include the nearest musical note, for example `69 Hz · C#2`.
- Renamed the frequency metric to `Dominant Tone` because a full mix may be dominated by bass or kick rather than its musical root.
- Added a peak-interval fallback for BPM when energy autocorrelation cannot find a stable tempo.
- Replaced the full-page blocking overlay with a compact 460 px floating editor card in the upper-right corner.
- The page remains fully interactive outside the card so video playback can be paused or adjusted while editing.
- The REC popup closes after STOP and hands off directly to the floating editor card.

### Phase 4.2 Persistent instrument panel

- Replaced the native dismissible Chrome popup with a persistent in-page panel toggled by the toolbar action.
- The panel remains open while the user interacts with the recorded page and closes on the next toolbar action click.
- Playback now starts from the current WaveSurfer playhead position.
- Removed the duplicated header timer and enlarged Play/WAV interaction areas.
- Added a pencil affordance and restrained input treatment for sample renaming.
- Rebuilt trim visuals with display-style cyan brackets and synchronized dark masks outside the WAV export range.

## Important Browser Behavior

The web app cannot silently capture the current tab.

For the MVP, the user must:

1. Press Record.
2. Choose a tab/source in the browser picker.
3. Enable tab audio sharing.
4. Stop recording inside the app.

The later extension phase should replace this with a more direct, store-compliant `chrome.tabCapture` flow after a user action.

## Verification

Automated:

- `npm run build` passes.
- Initial render captured in Chrome headless.
- `design-qa.md` final result is passed.

Manual still needed:

- Record from an actual Chrome/Edge tab with audible media.
- Confirm the waveform appears after stopping.
- Confirm the edited filename is used by WAV export.
- Confirm selection starts as the full recording.
- Confirm dragging start/end markers shows the large timestamp preview.
- Confirm loop playback stays inside the selected region.
- Confirm WAV export opens in a DAW or media player.

## Phase 3 Exit Criteria

Phase 3 is complete when the user confirms the MVP works manually in the browser:

- tab audio recording works;
- waveform appears;
- region selection works;
- loop playback works;
- WAV export works;
- delete/reset works.

After that, the suggested next phase is Phase 4: extension prototype.
