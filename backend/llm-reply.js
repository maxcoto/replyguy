/**
 * Generate a single reply (≤20 words) via OpenRouter. Direct API (no LangChain).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM = `You write a single reply to a tweet.
You sound like a real human, engaging and fresh.
The response MUST be FUN.

RULES:
- Max 12 words.
- No uppercase letters at all.
- Do not end the reply with a dot.
- Do not use emojis.
- Reply directly to what they said.
- Never sound like a bot or a corporate account.
- Be fun: a bit of wit, a hot take, a joke, or a sharp one-liner.
- Sound human: casual, use slang or abbreviations.
- Never lecture, never explain, never educate.
- Output ONLY the reply text. No quotes. No explanation. No preamble.`;

function extractText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return String(content).trim();
}

export async function generateReply(tweetText, authorHandle) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env to generate replies.");
  }

  const user = authorHandle ? `Tweet by ${authorHandle}:\n\n` : "";
  const userContent = `${user}${tweetText}`.trim();
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com",
    "X-Title": process.env.OPENROUTER_TITLE || "ReplyGuy",
  };

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
    max_tokens: 80,
    temperature: 0.85,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let errMsg = errBody;
    try {
      const j = JSON.parse(errBody);
      if (j?.error?.message) errMsg = j.error.message;
      else if (j?.message) errMsg = j.message;
    } catch (_) {}
    console.error("[ReplyGuy] OpenRouter error:", res.status, errMsg);
    throw new Error(errMsg || `OpenRouter error: ${res.status}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  if (!choice?.message) {
    console.error("[ReplyGuy] OpenRouter unexpected response:", JSON.stringify(data).slice(0, 500));
    throw new Error("OpenRouter returned no message. Try again.");
  }

  let text = extractText(choice.message.content);
  if (!text) {
    console.error("[ReplyGuy] OpenRouter empty content. Raw choice:", JSON.stringify(choice).slice(0, 300));
    throw new Error("Model returned an empty reply. Try again.");
  }

  const words = text.split(/\s+/);
  if (words.length > 20) {
    text = words.slice(0, 20).join(" ");
  }
  return text;
}
