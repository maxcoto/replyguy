/** ReplyGuy background: generate reply, post reply. */

const BACKEND_URL = "http://localhost:3000";

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
});

async function generateReply(payload) {
  const { tweetText, authorHandle } = payload;
  const url = `${BACKEND_URL}/reply`;
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

async function handlePostReply(payload) {
  const { text, tweetId, tweetText } = payload;

  if (!tweetId) {
    return { error: "Could not get tweet ID. Post from the tweet page or try again." };
  }

  const postUrl = `${BACKEND_URL}/post-reply`;
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

  return {};
}
