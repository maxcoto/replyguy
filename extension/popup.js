document.getElementById("suggest").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const suggested = document.getElementById("suggested");
  const copyBtn = document.getElementById("copy-suggested");
  status.textContent = "Generating…";
  const stored = await new Promise((r) => chrome.storage.local.get(["replyguyRepliedThisWeek", "replyguyBackendUrl"], r));
  const list = stored.replyguyRepliedThisWeek || [];
  const backendUrl = (stored.replyguyBackendUrl || "http://localhost:3000").replace(/\/$/, "");
  if (list.length === 0) {
    status.textContent = "No replies this week. Post some replies first.";
    return;
  }
  try {
    const res = await fetch(`${backendUrl}/suggest-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweets: list }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    suggested.value = data.suggestedPost || "";
    suggested.style.display = "block";
    copyBtn.style.display = "inline-block";
    status.textContent = "";
  } catch (e) {
    status.textContent = e.message || "Failed to suggest post.";
  }
});

document.getElementById("copy-suggested").addEventListener("click", () => {
  const suggested = document.getElementById("suggested");
  if (suggested.value) {
    navigator.clipboard.writeText(suggested.value);
    document.getElementById("status").textContent = "Copied.";
    setTimeout(() => { document.getElementById("status").textContent = ""; }, 1500);
  }
});
