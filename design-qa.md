# SampleX Display Timeline QA

source visual truth:

- Current approved 600 × 320 SampleX layout.
- Latest user requirements for display integration, trim masking, filename placement, controls, and color revision.

implementation screenshot:

- D:/Shuleyber/Documentos/Browser Sample Analyzer/design-qa-timeline-popup.png

viewport and state:

- 600 × 320, initial state without captured audio.

full-view evidence:

- Header contains only SAMPLEX.
- Filename and red Delete action are positioned together directly above the black waveform display.
- REC remains left, analysis remains below the waveform, Play remains centered, and WAV remains bottom-right.
- Header, body, and footer use one continuous surface without visible section bands.
- Play and WAV have visibly larger control surfaces while the popup remains 600 × 320 with no scrolling.

focused evidence:

- Waveform palette changed from bright cyan/white to neutral steel with warm ivory playback progress.
- Playback timeline is a thin amber line, visually distinct from the trim controls.
- Trim uses warm display brackets with inward caps. Non-interactive masks darken waveform outside the export interval while the selected audio stays sharp.
- Filename uses a pencil icon, dark editable surface, and warm focus state.
- Delete is a compact red secondary action beside the filename.
- The toolbar identity uses the REC control as a circular black/red icon at 16, 32, 48, and 128 px.

required fidelity surfaces:

- Typography: existing instrument typography retained; filename remains secondary but clearly editable.
- Spacing: approved control positions retained, with filename/Delete moved to the requested display row.
- Color: waveform and timeline now use a restrained steel/ivory/amber palette; red is limited to REC and Delete.
- Assets: extension icons are real PNG assets generated from the project REC mark; UI controls use the installed icon library.
- Copy: header is limited to SAMPLEX; no metrics or workflow actions were added.

verification:

- Initial state visually verified at 600 × 320 with no overflow.
- Browser console reports no errors or warnings.
- TypeScript and Vite production build pass.
- Manifest includes all icon sizes and the persistent-panel scripts.
- Real waveform masks, amber brackets, playhead movement, filename editing, and downloads require final manual validation with captured audio in Chrome.

findings:

- No actionable P0/P1/P2 issue remains in the initial state.

follow-up polish:

- P3: calibrate bracket cap length, mask opacity, and waveform progress color using a dense real recording.

final result: passed
