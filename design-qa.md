# SampleX design QA

Viewport checked: 600 × 320 px.

- [x] Popup fits without vertical or horizontal scroll.
- [x] Existing horizontal layout and control positions are preserved.
- [x] Panel corners are rounded and use restrained inset highlights and depth.
- [x] Filename field keeps a dark instrument-display treatment while focused.
- [x] Delete uses the same compact physical-control language, with restrained red hierarchy and hover feedback.
- [x] Play and WAV controls share a 32 px height and the same vertical baseline; WAV has an 18 px right inset.
- [x] Trim interaction retains large hit targets while the visible brackets are larger, white, and high contrast.
- [x] Unselected waveform areas are covered by deterministic left and right masks.
- [x] Pointer hover renders a temporary cyan timeline; leaving restores the committed WaveSurfer playhead and clicking commits the new time.
- [x] Empty-state hierarchy, spacing, and contrast were visually checked in the in-app browser.
- [x] TypeScript and production build pass.

Recorded-audio behavior is covered by the same persistent layout and was verified at implementation level (region state, masks, brackets, hover preview, click commit). Reload the unpacked extension to exercise Chrome tab capture with the new build.
