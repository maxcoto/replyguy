/**
 * Suggest one weekly post (conviction or conversation hook) from replied tweets. OpenRouter.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

let model = null;

function getModel() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env to suggest posts.");
  }
  if (!model) {
    model = new ChatOpenAI(
      {
        modelName: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature: 0.8,
        maxTokens: 280,
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

const SYSTEM = `You suggest one X (Twitter) post for a builder in crypto/DeFi/web3.
Style:
- Either a conviction post (strong take on ETH, DeFi mechanics, leverage cycles) or a conversation hook (question serious builders can answer).
- Short punch line, 2–4 supporting lines, one tension hook or question at the end.
- Technical, builder-focused; no beginner education or safe takes.
- Create tension: make the reader think or answer, e.g. "If this drop makes you panic, you're overexposed or under-convicted. Which one?"
Output only the post text, ready to paste. No preamble or "Here's a post:".`;

export async function suggestPost(tweets) {
  const m = getModel();
  const lines = tweets.map((t, i) => {
    const auth = t.authorHandle || "";
    const tweet = (t.tweetText || "").slice(0, 300);
    const reply = (t.replyText || "").slice(0, 200);
    return `[${i + 1}] ${auth}\nTweet: ${tweet}\nYour reply: ${reply}`;
  });
  const block = lines.join("\n\n");
  const response = await m.invoke([
    new SystemMessage(SYSTEM),
    new HumanMessage(`Tweets I replied to this week:\n\n${block}\n\nSuggest one engaging post (conviction or conversation hook) based on these themes.`),
  ]);
  return (response.content && String(response.content)).trim();
}
