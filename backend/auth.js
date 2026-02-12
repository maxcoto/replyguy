/**
 * X API: Create Post (reply) via OAuth 1.0a using server-side credentials.
 */
import crypto from "crypto";
import OAuth from "oauth-1.0a";

const X_CREATE_POST = "https://api.x.com/2/tweets";

function getOAuth1Config() {
  return {
    apiKey: process.env.X_API_KEY || "",
    apiSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
  };
}

function hasOAuth1Credentials() {
  const c = getOAuth1Config();
  return !!(c.apiKey && c.apiSecret && c.accessToken && c.accessTokenSecret);
}

export async function postReply(req, res) {
  const { text, tweetId, tweetText: originalPostContent } = req.body || {};
  const postId = tweetId ? String(tweetId) : "";
  const replyContent = text ? String(text).slice(0, 280) : "";

  if (!replyContent || !postId) {
    return res.status(400).json({ error: "text and tweetId required" });
  }

  console.log("[ReplyGuy] post-reply request:", {
    postId,
    postContent: originalPostContent || "(not sent)",
    replyContent,
  });

  const body = {
    text: replyContent,
    reply: { in_reply_to_tweet_id: postId },
  };

  if (!hasOAuth1Credentials()) {
    return res.status(401).json({
      error: "Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in backend/.env",
    });
  }

  const o1 = getOAuth1Config();
  const oauth = OAuth({
    consumer: { key: o1.apiKey, secret: o1.apiSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
  const requestData = { url: X_CREATE_POST, method: "POST", data: {} };
  const token = { key: o1.accessToken, secret: o1.accessTokenSecret };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const postRes = await fetch(X_CREATE_POST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    console.log("[ReplyGuy] post-reply result: FAILED", { postId, status: postRes.status, error: errText });
    if (postRes.status === 403 && errText.includes("oauth1") && errText.includes("permissions")) {
      return res.status(403).json({
        error: "X app is not allowed to post. In developer.x.com → your app → Settings: set App permissions to 'Read and write', enable OAuth 1.0a if needed, then regenerate your Access Token and Secret.",
      });
    }
    return res.status(postRes.status).send(errText || "X API error");
  }

  const data = await postRes.json();
  console.log("[ReplyGuy] post-reply result: OK", { postId, replyTweetId: data?.data?.id, replyContent });
  res.json(data);
}
