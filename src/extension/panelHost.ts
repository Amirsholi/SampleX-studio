export {};

(() => {
  const hostId = "samplex-persistent-panel";
  const existing = document.getElementById(hostId);

  if (existing) {
    existing.remove();
    return;
  }

  const host = document.createElement("div");
  host.id = hostId;
  host.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;width:min(600px,calc(100vw - 24px));height:320px;pointer-events:none;";

  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("popup.html");
  frame.title = "SampleX tab audio sampler";
  frame.allow = "autoplay";
  frame.style.cssText = "display:block;width:100%;height:100%;border:0;border-radius:3px;background:#11161c;box-shadow:0 18px 55px rgba(0,0,0,.42);pointer-events:auto;";
  host.appendChild(frame);
  document.documentElement.appendChild(host);
})();
