/** ReplyGuy background: generate reply, post reply, replied-this-week tracking. */

const REPLYGUY_STORAGE_KEYS = ["replyguyBackendUrl", "replyguyRepliedThisWeek"];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REPLYGUY_GENERATE") {
    generateReply(message.payload)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "REPLYGUY_POST") {
    handlePostReply(message.payload)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "REPLYGUY_TRACK") {
    trackRepliedTweet(message.payload).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function generateReply(payload) {
  const { tweetText, authorHandle } = payload;
  const stored = await getStored();
  const backendUrl = (stored.replyguyBackendUrl || "http://localhost:3000").replace(/\/$/, "");
  const url = `${backendUrl}/reply`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweetText, authorHandle }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
    } catch (_) {
      try { msg = await res.text() || msg; } catch (_) {}
    }
    throw new Error(msg || "Reply generation failed");
  }
  const data = await res.json();
  return { replyText: (data.replyText || data.reply || "").trim().slice(0, 280) };
}

async function getStored() {
  return new Promise((resolve) => {
    chrome.storage.local.get(REPLYGUY_STORAGE_KEYS, resolve);
  });
}

async function handlePostReply(payload) {
  const { text, tweetId, tweetText } = payload;
  const stored = await getStored();
  const backendUrl = (stored.replyguyBackendUrl || "http://localhost:3000").replace(/\/$/, "");

  if (!tweetId) {
    return { error: "Could not get tweet ID. Post from the tweet page or try again." };
  }

  const postUrl = `${backendUrl}/post-reply`;
  const res = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, tweetId, tweetText: tweetText || null }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let err = raw;
    try {
      const j = JSON.parse(raw);
      if (j && j.error) err = j.error;
    } catch (_) {}
    return { error: err || `Post failed: ${res.status}` };
  }

  return { track: true };
}

async function trackRepliedTweet(payload) {
  const stored = await getStored();
  const list = Array.isArray(stored.replyguyRepliedThisWeek) ? stored.replyguyRepliedThisWeek : [];
  list.push({
    tweetText: payload.tweetText,
    authorHandle: payload.authorHandle,
    replyText: payload.replyText,
    at: new Date().toISOString(),
  });
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trimmed = list.filter((x) => new Date(x.at).getTime() > weekAgo);
  await new Promise((r) => chrome.storage.local.set({ replyguyRepliedThisWeek: trimmed }, r));
}
