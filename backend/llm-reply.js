/**
 * Generate a single reply (≤20 words) via OpenRouter. Direct API (no LangChain).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM = `You write a single reply to a tweet.
You sound like a real human, engaging and fresh.
The response MUST be FUN.
MUST Output ONLY the reply text. No quotes. No explanation. No preamble.

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
`;

/** Max tweet length sent to the model; longer prompts can cause empty replies. */
const MAX_TWEET_CHARS = 280;

/** Collapse newlines and strip control chars so multi-line tweets don't break the API. */
function normalizeTweetText(str) {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/\r\n|\r|\n|\u2028|\u2029/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim();
}

/** Truncate to avoid empty model responses on long tweets. */
function truncateForLlm(str) {
  if (!str || str.length <= MAX_TWEET_CHARS) return str;
  const cut = str.slice(0, MAX_TWEET_CHARS).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > MAX_TWEET_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
}

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

  const normalizedTweet = normalizeTweetText(tweetText);
  const truncatedTweet = truncateForLlm(normalizedTweet);
  const prefix = authorHandle ? `Tweet by ${authorHandle}:\n` : "";
  const userContent = `${prefix}${truncatedTweet}`.trim();
  if (!userContent) {
    throw new Error("Tweet text is empty after normalizing.");
  }
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
    max_tokens: 150,
    temperature: 0.85,
  };

  const bodyStr = JSON.stringify(body);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: bodyStr,
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
    if (text) {
      const words = text.split(/\s+/);
      if (words.length > 20) text = words.slice(0, 20).join(" ");
      return text;
    }

    if (attempt < 3) {
      console.warn("[ReplyGuy] OpenRouter empty content, retry", attempt, "of 3. finish_reason:", choice.finish_reason);
    } else {
      console.error("[ReplyGuy] OpenRouter empty content after 3 attempts. Raw choice:", JSON.stringify(choice).slice(0, 500));
      throw new Error("Model returned an empty reply. Try again.");
    }
  }
  throw new Error("Model returned an empty reply. Try again.");
}
