# ReplyGuy

**One-click sharp replies on X.** A Chrome extension plus a small Node backend that generates short, human-sounding replies (≤20 words) for tweets and can post them for you. Built for crypto/DeFi builders who want more engagement without sounding like a bot.

---

## Features

- **ReplyGuy button on every tweet** — Click to get an LLM-generated reply. Fun, engaging, short. Edit, copy, or post in one click.
- **No timeline API** — You browse X normally (including “For You”). The extension only adds the button and posts when you choose. **Free X API tier friendly.**
- **Weekly post idea** — From the extension popup, generate one “conviction post” or conversation hook based on tweets you replied to this week.
- **One-click post** — Post replies using your **server-side X credentials** (OAuth 1.0a in `backend/.env`). No connect flow in the extension.

---

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env
# Edit .env: set OPENROUTER_API_KEY and (optional) X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
npm install
npm start
```

```text
# 2. Extension
# Chrome → More tools → Extensions → Developer mode → Load unpacked → select the `extension` folder
```

```text
# 3. Use
# Open x.com, click ReplyGuy on any tweet, get a reply, then Copy or Post reply
```

Backend runs at **http://localhost:3000**. The extension uses that URL by default.

---

## Setup details

### Backend env (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | For reply and weekly-post generation. Get a key at [openrouter.ai](https://openrouter.ai). |
| `OPENROUTER_MODEL` | No | Default `openai/gpt-4o-mini`. Use any [OpenRouter model](https://openrouter.ai/docs/models). |
| `X_API_KEY` | For posting | OAuth 1.0a consumer key (API Key in developer.x.com). |
| `X_API_SECRET` | For posting | OAuth 1.0a consumer secret. |
| `X_ACCESS_TOKEN` | For posting | User access token (from Keys and tokens). |
| `X_ACCESS_TOKEN_SECRET` | For posting | User access token secret. |
| `PORT` | No | Default `3000`. |

**Posting:** Set `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` in `backend/.env`. The extension posts using these credentials.

### X app permissions (for posting)

In [developer.x.com](https://developer.x.com/) → your app → **Settings**:

- Set **App permissions** to **Read and write** (not Read only).
- Ensure **OAuth 1.0a** is enabled for the app.
- After changing permissions, **regenerate** Access Token and Secret and update your `.env`.

---

## Project structure

```text
replyguy/
├── backend/           # Node server (reply, suggest-post, post-reply)
│   ├── server.js
│   ├── auth.js       # OAuth 1.0a: post reply to X
│   ├── llm-reply.js  # OpenRouter: generate reply
│   ├── llm-suggest.js
│   ├── load-env.js
│   ├── rate-limit.js
│   └── .env.example
├── extension/        # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js # Generate reply, post reply, tracking
│   ├── content.js   # Inject button + modal on x.com
│   ├── content.css
│   ├── popup.html
│   └── popup.js
├── README.md
├── LICENSE
└── .gitignore
```

---

## API (backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health: `{ name, ok }`. |
| POST | `/reply` | Body: `{ tweetText, authorHandle? }`. Returns `{ replyText }`. |
| POST | `/suggest-post` | Body: `{ tweets: [{ tweetText, authorHandle?, replyText? }] }`. Returns `{ suggestedPost }`. |
| POST | `/post-reply` | Body: `{ text, tweetId, tweetText? }`. Creates reply on X (OAuth 1.0a, server credentials). |

Rate limits: 60/min per IP for `/reply`, 20/min for `/suggest-post`.

---

## Troubleshooting

**403 “oauth1 app permissions” when posting**

- In developer.x.com → your app: set **App permissions** to **Read and write**, enable **OAuth 1.0a** if needed, then **regenerate** Access Token and Secret and update `X_ACCESS_TOKEN` and `X_ACCESS_TOKEN_SECRET` in `.env`.

**“OPENROUTER_API_KEY is not set”**

- Add `OPENROUTER_API_KEY` to `backend/.env` and restart the backend.

**No reply / “Extension error”**

- Ensure the backend is running at `http://localhost:3000` and the extension is loaded. Replies are requested by the extension’s background script from that URL.

---

## License

MIT. See [LICENSE](LICENSE).
