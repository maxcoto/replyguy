/**
 * ReplyGuy backend – reply generation, weekly post suggestion, post reply (OAuth 1.0a).
 */
import "./load-env.js";
import express from "express";
import cors from "cors";
import { generateReply } from "./llm-reply.js";
import { suggestPost } from "./llm-suggest.js";
import { postReply } from "./auth.js";
import { rateLimitReply, rateLimitSuggest } from "./rate-limit.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const PORT = Number(process.env.PORT) || 3847;

app.get("/", (req, res) => {
  res.json({ name: "ReplyGuy", ok: true });
});

app.post("/reply", rateLimitReply, async (req, res) => {
  try {
    const { tweetText, authorHandle } = req.body || {};
    if (!tweetText || typeof tweetText !== "string") {
      console.log("[ReplyGuy] /reply bad request: tweetText required");
      return res.status(400).json({ error: "tweetText required" });
    }
    const tweet = tweetText.trim();
    const author = authorHandle || "";
    console.log("[ReplyGuy] /reply request:", { tweet: tweet.slice(0, 200) + (tweet.length > 200 ? "…" : ""), author });
    const replyText = await generateReply(tweet, author);
    console.log("[ReplyGuy] /reply replyText:", { replyText });
    res.json({ replyText });
  } catch (err) {
    console.error("[ReplyGuy] /reply error:", err.message || err);
    res.status(500).json({ error: err.message || "Reply generation failed" });
  }
});

app.post("/suggest-post", rateLimitSuggest, async (req, res) => {
  try {
    const list = req.body?.tweets;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: "tweets array required" });
    }
    const suggested = await suggestPost(list);
    res.json({ suggestedPost: suggested });
  } catch (err) {
    console.error("/suggest-post", err);
    res.status(500).json({ error: err.message || "Suggest failed" });
  }
});

app.post("/post-reply", postReply);

app.listen(PORT, () => {
  console.log(`ReplyGuy backend http://localhost:${PORT}`);
});
