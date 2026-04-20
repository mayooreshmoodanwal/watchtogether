# ANTP 🎬

Watch YouTube with long-distance friends — synced playback, live video calls, and real-time chat. No install needed. Works in Chrome and Brave.

---

## Features

- 🔗 **Room Codes** — Share a 6-character code. Anyone with it joins instantly.
- ▶️ **YouTube Sync** — Host controls play/pause/seek. All peers sync within 1 second.
- 📹 **Video Calls** — Up to 8 face-cam tiles via WebRTC. Mic/cam toggle per user.
- 💬 **Live Chat** — Real-time messages, emoji picker, and emoji reactions.
- 🔒 **Secure** — HTTPS everywhere, encrypted WebRTC streams, no accounts, no PII stored.

---

## Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
# The defaults in .env.example use Metered.ca free STUN/TURN — works out of the box
```

### 3. Build Next.js
```bash
npm run build
```

### 4. Start the server
```bash
npm start
# or for development with hot reload:
npm run dev
```

Open http://localhost:3000 in Chrome or Brave.

---

## Deploying to Render.com (Recommended — Free, supports WebSockets)

ANTP uses Socket.io with persistent WebSocket connections. **Render.com** is the easiest free host for this.

### Steps:
1. Push this repo to GitHub (make sure `.env.local` is in `.gitignore` — it already is)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Add Environment Variables in Render dashboard:
   - `NEXT_PUBLIC_TURN_URL` = `turn:openrelay.metered.ca:80`
   - `NEXT_PUBLIC_TURN_USERNAME` = `openrelayproject`
   - `NEXT_PUBLIC_TURN_CREDENTIAL` = `openrelayproject`
   - `NODE_ENV` = `production`
6. Deploy — Render gives you a public HTTPS URL like `https://antp.onrender.com`
7. Share that URL with friends — they join by entering the room code on the landing page.

---

## Deploying to Railway.app (Alternative Free Host)

1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add the same environment variables as above
4. Railway auto-detects Node.js and runs `npm start`
5. Get your public URL from the Railway dashboard

---

## Deploying to Vercel (Limited — read note)

> ⚠️ **Note:** Vercel's serverless platform has a 10-second timeout on functions and does not natively support persistent WebSocket connections. ANTP uses Socket.io which requires persistent connections. **Vercel works for demos/testing** but may drop connections under load. For production, use Render or Railway above.

If you still want Vercel:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `npm run build` first
3. Set environment variables in Vercel dashboard
4. Run `vercel --prod`

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_TURN_URL` | TURN server URL | `turn:openrelay.metered.ca:80` |
| `NEXT_PUBLIC_TURN_USERNAME` | TURN username | `openrelayproject` |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | TURN password | `openrelayproject` |
| `PORT` | Server port | `3000` |

The default TURN config uses the free [Open Relay Project](https://www.metered.ca/tools/openrelay/) by Metered.ca — no signup needed.

---

## Tech Stack

- **Next.js 14** — React framework, App Router
- **Socket.io** — Real-time signalling and chat
- **WebRTC** — Peer-to-peer video/audio calls
- **YouTube iFrame API** — Synchronized video playback
- **TypeScript** — Type safety throughout

---

## Browser Support

| Browser | Support |
|---|---|
| Chrome | ✅ Full support |
| Brave | ✅ Full support |
| Firefox | ⚠️ Not officially supported in v1.0 |
| Safari | ⚠️ Not officially supported in v1.0 |
| Mobile | ⚠️ Not officially supported in v1.0 |

---

## Architecture

```
Browser (Host)
  └── YouTube iFrame API
       └── play/pause/seek events
            └── Socket.io → Server → broadcast → Peer browsers
                                                    └── YouTube iFrame API (synced)

Browser A ↔ Browser B  (WebRTC P2P video/audio)
           ↕ ICE negotiation via STUN/TURN
         Socket.io Server (signalling + chat)
```
# watchtogether
