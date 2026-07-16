# Chrome Web Store privacy answers

Use these answers as the baseline for the Privacy practices tab. Recheck them against the dashboard wording at submission time.

## Single purpose

SampleX lets the user record audio from the active browser tab, trim and analyze the selected sample locally, and export it as a WAV file.

## Permission justifications

- `activeTab`: limits SampleX interaction to the tab where the user explicitly opens the extension.
- `tabCapture`: captures audio from the active tab only after the user presses REC.
- `offscreen`: keeps the user-initiated recording running through Chrome's supported offscreen audio-capture document.
- `scripting`: injects the SampleX panel host into the active tab when the toolbar button is pressed.
- `storage`: saves recording/editing state, remaining free exports and permanent license restoration state.

The extension requests no host permissions and does not read arbitrary browsing history.

## Data handling disclosure

SampleX handles active-tab audio and related waveform/analysis data only to provide recording, trimming, analysis and WAV export. This content is processed locally and is not transmitted to the developer's servers. Local extension state remains in Chrome storage. Permanent license tokens may be stored through Chrome Sync.

Purchase checkout happens on the public SampleX website through Polar. Card data is never sent to or stored by the extension.

## Certifications

- Data is not sold.
- Data is not used for personalized advertising.
- Data is not used for creditworthiness or lending.
- Audio or browsing content is not used for analytics or AI model training.
- Human access to recorded audio is not permitted.
- Data use complies with the Chrome Web Store User Data Policy, including Limited Use requirements.

Privacy policy URL: `https://amirsholi.vercel.app/samplex/privacy`
