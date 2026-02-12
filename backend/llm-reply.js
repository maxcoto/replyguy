/**
 * Generate a single reply (≤20 words) via OpenRouter. Niche: crypto/DeFi. Fun, short, human.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

let model = null;

function getModel() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env to generate replies.");
  }
  if (!model) {
    model = new ChatOpenAI(
      {
        modelName: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature: 0.85,
        maxTokens: 80,
        apiKey: process.env.OPENROUTER_API_KEY,
      },
      {
        basePath: OPENROUTER_BASE,
        baseOptions: {
          headers: {
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://github.com",
            "X-Title": process.env.OPENROUTER_TITLE || "ReplyGuy",
          },
        },
      }
    );
  }
  return model;
}

const SYSTEM = `
You write a single reply to a tweet.
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
- Output ONLY the reply text. No quotes. No explanation. No preamble.
`;

export async function generateReply(tweetText, authorHandle) {
  const m = getModel();
  const user = authorHandle ? `Tweet by ${authorHandle}:\n\n` : "";
  const message = `${user}${tweetText}`;
  const response = await m.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(message),
  ]);
  let text = (response.content && String(response.content)).trim();
  const words = text ? text.split(/\s+/).length : 0;
  if (words > 20) {
    text = text.split(/\s+/).slice(0, 20).join(" ");
  }
  return text;
}
