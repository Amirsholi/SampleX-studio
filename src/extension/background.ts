import type { ExtensionMessage, ExtensionState } from "./messages";

const DEFAULT_STATE: ExtensionState = { status: "idle" };

chrome.runtime.onInstalled.addListener(() => void setState(DEFAULT_STATE));

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  void chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["assets/panelHost.js"] }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_START" || message.type === "OFFSCREEN_STOP" || message.type === "LIVE_WAVEFORM") return false;
  void handleMessage(message).then(sendResponse).catch((error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    void setState({ status: "error", error: text });
    sendResponse({ ok: false, error: text });
  });
  return true;
});

async function handleMessage(message: ExtensionMessage) {
  if (message.type === "GET_STATE") return getState();

  if (message.type === "START_RECORDING") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab is available.");
    await setState({ status: "starting", sourceTitle: tab.title ?? "Tab audio", sourceTabId: tab.id });
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_START", streamId, sourceTitle: tab.title ?? "Tab audio" } satisfies ExtensionMessage);
    await setState({ status: "recording", startedAt: Date.now(), sourceTitle: tab.title ?? "Tab audio", sourceTabId: tab.id });
    return { ok: true };
  }

  if (message.type === "STOP_RECORDING") {
    const current = await getState();
    await setState({ ...current, status: "stopping" });
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" } satisfies ExtensionMessage);
    return { ok: true };
  }

  if (message.type === "RECORDING_SAVED") {
    const current = await getState();
    await setState({ ...current, status: "ready", startedAt: undefined });
    return { ok: true };
  }

  if (message.type === "RECORDING_ERROR") {
    await setState({ status: "error", error: message.error });
    return { ok: true };
  }

  return { ok: true };
}

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL("offscreen.html");
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [url] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: [chrome.offscreen.Reason.USER_MEDIA], justification: "Record audio from the active tab after the user presses REC." });
  }
}

async function getState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get("recordingState");
  return (stored.recordingState as ExtensionState | undefined) ?? DEFAULT_STATE;
}

async function setState(state: ExtensionState) {
  await chrome.storage.local.set({ recordingState: state });
}
