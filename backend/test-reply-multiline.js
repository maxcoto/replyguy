/**
 * Test /reply with multi-line tweet text to reproduce newline-related failures.
 * Run: node test-reply-multiline.js
 * Requires: server running (npm start) and OPENROUTER_API_KEY in .env
 */

import "./load-env.js";

const BACKEND = "http://localhost:3847";

const multiLineTweet = `first line of the tweet
second line here
and a third line for good measure`;

const shortMultiLine = "gm frens\nwho's buying the dip";

async function test(label, body) {
  console.log("\n---", label, "---");
  try {
    const res = await fetch(`${BACKEND}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log("FAIL", res.status, data.error || data);
      return false;
    }
    console.log("OK", "replyText:", (data.replyText || "").slice(0, 80) + (data.replyText?.length > 80 ? "…" : ""));
    return true;
  } catch (e) {
    console.log("ERROR", e.message);
    return false;
  }
}

async function main() {
  console.log("ReplyGuy multi-line tweet test (backend:", BACKEND, ")");

  const oneLine = await test("One-line tweet", {
    tweetText: "btc to 100k next week",
    authorHandle: "@crypto",
  });

  const shortMulti = await test("Short multi-line (\\n)", {
    tweetText: shortMultiLine,
    authorHandle: "@user",
  });

  const multiLine = await test("Long multi-line (\\n)", {
    tweetText: multiLineTweet,
    authorHandle: "@user",
  });

  const multiLineCRLF = await test("Multi-line tweet (\\r\\n)", {
    tweetText: "line one\r\nline two\r\nline three",
    authorHandle: "@user",
  });

  console.log("\n--- Summary ---");
  console.log("One-line:", oneLine ? "PASS" : "FAIL");
  console.log("Short multi-line \\n:", shortMulti ? "PASS" : "FAIL");
  console.log("Long multi-line \\n:", multiLine ? "PASS" : "FAIL");
  console.log("Multi-line \\r\\n:", multiLineCRLF ? "PASS" : "FAIL");
  const allPass = oneLine && shortMulti && multiLine && multiLineCRLF;
  process.exit(allPass ? 0 : 1);
}

main();
