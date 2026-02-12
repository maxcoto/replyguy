/** ReplyGuy content script: inject button on each tweet, open modal, generate/post reply. */

(function () {
  const REPLYGUY_BTN_CLASS = "replyguy-btn";
  const REPLYGUY_MARKER = "data-replyguy-injected";

  /**
   * Find tweet containers on X. Prefer data-testid; fallback to article with tweet-like structure.
   */
  function findTweetContainers() {
    const byTestId = document.querySelectorAll('article[data-testid="tweet"]');
    if (byTestId.length > 0) return Array.from(byTestId);

    const articles = document.querySelectorAll('article[role="link"]');
    return Array.from(articles).filter((el) => {
      const text = el.textContent || "";
      return text.length > 20 && text.length < 2000 && !el.querySelector(`[${REPLYGUY_MARKER}]`);
    });
  }

  /**
   * Extract tweet text from a tweet container.
   * X.com DOM changes often; try multiple selectors.
   */
  function getTweetText(container) {
    let text = "";
    const byTestId = container.querySelector('[data-testid="tweetText"]');
    if (byTestId) text = (byTestId.textContent || "").trim();
    if (!text || text.length < 5) {
      const withLang = container.querySelector("[lang]");
      if (withLang) {
        const t = (withLang.textContent || "").trim();
        if (t.length > 15 && t.length < 2000) text = t;
      }
    }
    if (!text || text.length < 5) {
      const full = (container.textContent || "").trim();
      if (full.length > 20 && full.length < 3000) text = full;
    }
    return { text: (text || "").slice(0, 2000) };
  }

  /**
   * Extract author handle (e.g. @user) from container.
   */
  function getAuthorHandle(container) {
    const link = container.querySelector('a[role="link"][href^="/"]');
    if (!link) return "";
    const href = link.getAttribute("href") || "";
    const match = href.match(/^\/([a-zA-Z0-9_]+)\/?/);
    return match ? `@${match[1]}` : "";
  }

  /**
   * Extract tweet ID from permalink in the container.
   */
  function getTweetId(container) {
    const links = container.querySelectorAll('a[href*="/status/"]');
    for (const a of links) {
      const m = (a.getAttribute("href") || "").match(/\/status\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function injectButton(container) {
    if (container.getAttribute(REPLYGUY_MARKER)) return;

    const actionBar = container.querySelector('[role="group"]') ||
      container.querySelector('[data-testid="app-text-transition-container"]')?.closest("div")?.parentElement ||
      container.querySelector("div[role='button']")?.parentElement?.parentElement;

    let anchor = actionBar;
    if (!anchor) {
      const allDivs = container.querySelectorAll("div");
      for (const d of allDivs) {
        if (d.childNodes.length >= 4 && d.querySelector('div[role="button"]')) {
          anchor = d;
          break;
        }
      }
    }
    if (!anchor) anchor = container;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = REPLYGUY_BTN_CLASS;
    btn.textContent = "ReplyGuy";
    btn.setAttribute(REPLYGUY_MARKER, "true");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openReplyModal(container);
    });

    anchor.appendChild(btn);
    container.setAttribute(REPLYGUY_MARKER, "true");
  }

  function openReplyModal(container) {
    const { text: tweetText } = getTweetText(container);
    const authorHandle = getAuthorHandle(container);
    const tweetId = getTweetId(container);

    if (!tweetText) {
      alert("ReplyGuy: Could not read tweet text.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "replyguy-overlay";

    const modal = document.createElement("div");
    modal.className = "replyguy-modal";

    modal.innerHTML = `
      <div class="replyguy-modal-header">ReplyGuy</div>
      <div class="replyguy-modal-body">
        <textarea id="replyguy-draft" placeholder="Generating…" maxlength="280" disabled></textarea>
        <div class="replyguy-word-count" id="replyguy-word-count">0 / 20 words</div>
        <div class="replyguy-error" id="replyguy-error" style="display:none;"></div>
        <div class="replyguy-modal-actions">
          <button type="button" class="replyguy-copy-btn" id="replyguy-copy">Copy</button>
          <button type="button" class="replyguy-post-btn" id="replyguy-post">Post reply</button>
          <button type="button" class="replyguy-close-btn" id="replyguy-close">Close</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector("#replyguy-draft");
    const wordCountEl = modal.querySelector("#replyguy-word-count");
    const errorEl = modal.querySelector("#replyguy-error");

    function updateWordCount() {
      const t = (textarea.value || "").trim();
      const words = t ? t.split(/\s+/).length : 0;
      wordCountEl.textContent = `${words} / 20 words`;
      wordCountEl.classList.toggle("over", words > 20);
    }

    textarea.addEventListener("input", updateWordCount);

    function showError(msg) {
      errorEl.textContent = msg || "";
      errorEl.style.display = msg ? "block" : "none";
    }

    chrome.runtime.sendMessage(
      { type: "REPLYGUY_GENERATE", payload: { tweetText, authorHandle } },
      (response) => {
        textarea.placeholder = "Edit reply if needed…";
        textarea.disabled = false;
        if (chrome.runtime.lastError) {
          showError(chrome.runtime.lastError.message || "Extension error.");
          return;
        }
        if (response?.error) {
          showError(response.error);
          return;
        }
        const reply = (response?.replyText || "").trim().slice(0, 280);
        textarea.value = reply;
        updateWordCount();
      }
    );

    modal.querySelector("#replyguy-copy").addEventListener("click", () => {
      const t = textarea.value.trim();
      if (t) {
        navigator.clipboard.writeText(t).then(() => {
          const copyBtn = modal.querySelector("#replyguy-copy");
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
        });
      }
    });

    modal.querySelector("#replyguy-post").addEventListener("click", () => {
      const text = textarea.value.trim();
      if (!text) return;
      chrome.runtime.sendMessage(
        { type: "REPLYGUY_POST", payload: { text, tweetId, tweetText, authorHandle } },
        (response) => {
          if (response?.error) showError(response.error);
          else overlay.remove();
        }
      );
    });

    modal.querySelector("#replyguy-close").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function run() {
    const containers = findTweetContainers();
    containers.forEach(injectButton);
  }

  const observer = new MutationObserver(() => run());
  observer.observe(document.body, { childList: true, subtree: true });
  run();
})();
