export {};

(() => {
  const hostId = "samplex-persistent-panel";
  const existing = document.getElementById(hostId);

  if (existing) {
    const isHidden = existing.dataset.samplexHidden === "true";
    existing.dataset.samplexHidden = isHidden ? "false" : "true";
    existing.style.visibility = "visible";
    existing.style.opacity = isHidden ? "1" : "0";
    existing.style.transform = isHidden ? "translate(0,0) scale(1)" : "translate(14px,-12px) scale(.96)";
    const frame = existing.querySelector("iframe");
    if (frame) frame.style.pointerEvents = isHidden ? "auto" : "none";
    if (!isHidden) window.setTimeout(() => {
      if (existing.dataset.samplexHidden === "true") existing.style.visibility = "hidden";
    }, 210);
    return;
  }

  const host = document.createElement("div");
  host.id = hostId;
  host.dataset.samplexHidden = "false";
  host.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;width:min(600px,calc(100vw - 24px));height:286px;pointer-events:none;opacity:0;transform:translate(14px,-12px) scale(.96);transform-origin:top right;transition:opacity 180ms ease,transform 210ms cubic-bezier(.2,.8,.2,1);";

  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("popup.html");
  frame.title = "SampleX tab audio sampler";
  frame.allow = "autoplay";
  frame.style.cssText = "display:block;width:100%;height:100%;border:0;border-radius:10px;background:transparent;box-shadow:0 18px 55px rgba(0,0,0,.46),0 1px 0 rgba(255,255,255,.06);pointer-events:auto;";
  host.appendChild(frame);
  document.documentElement.appendChild(host);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    host.style.opacity = "1";
    host.style.transform = "translate(0,0) scale(1)";
  }));
})();
