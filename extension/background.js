let ws = null;
let buffer = [];
let reconnectTimer = null;

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket("ws://localhost:19876");

    ws.onopen = () => {
      console.log("[Chronos] Connected to daemon");
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      // Flush buffer
      while (buffer.length > 0) {
        ws.send(JSON.stringify(buffer.shift()));
      }
    };

    ws.onclose = () => {
      console.log("[Chronos] Disconnected from daemon");
      ws = null;
      if (!reconnectTimer) {
        reconnectTimer = setInterval(connect, 5000);
      }
    };

    ws.onerror = () => {
      ws = null;
    };
  } catch (e) {
    console.error("[Chronos] Connection error:", e);
  }
}

function sendTabInfo(tab) {
  if (!tab || !tab.url) return;
  // Skip internal browser pages
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

  const msg = {
    type: "tab_update",
    url: tab.url,
    title: tab.title || "",
    timestamp: new Date().toISOString(),
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    buffer.push(msg);
    // Keep buffer bounded
    if (buffer.length > 50) buffer.shift();
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    sendTabInfo(tab);
  } catch (e) {
    // Tab may have been closed
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    sendTabInfo(tab);
  }
});

connect();
