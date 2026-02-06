// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_FILL_ON_TAB" && msg.tabId) {
    // Content script is registered in manifest; we just ping it once tab is ready.
    // A short delay ensures DOM is present (many frameworks render after load).
    setTimeout(() => {
      chrome.tabs.sendMessage(msg.tabId, { type: "FILL_NOW" });
    }, 2500);
  }
});
