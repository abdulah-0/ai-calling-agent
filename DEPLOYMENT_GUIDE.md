# 🚀 Deployment Guide

Your AI Calling Agent uses **WebSockets** for real-time audio streaming and **Fastify** as a persistent server. This architecture affects your deployment choices.

## ⚠️ Important Note About Vercel
Vercel is optimized for **Serverless Functions** and **Frontend** hosting. It is **NOT** ideal for long-running WebSocket servers (like this AI agent) because:
1.  **Timeouts**: Serverless functions have a maximum execution time (usually 10-60 seconds), which will cut off long calls.
2.  **WebSockets**: Vercel Serverless does not support persistent WebSocket connections natively in the same way a VPS does.

**Recommendation**: Use **Railway** or **Render** for the backend (WebSocket server) and optionally use Vercel for the Dashboard (frontend).

---

## ✅ Option 1: Railway (Recommended)
Railway is the easiest way to deploy this exact application because it supports persistent Node.js servers and WebSockets out of the box.

1.  **Sign up** at [railway.app](https://railway.app/)
2.  Click **New Project** -> **Deploy from GitHub repo**
3.  Select your repo: `ai_calling_agent`
4.  **Variables**: Add your environment variables in the Railway dashboard:
    *   `TELNYX_API_KEY`
    *   `OPENAI_API_KEY`
    *   `SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `PORT` (Railway sets this automatically, usually 3000 or 8080)
5.  **Deploy**: Railway will detect `package.json` and deploy automatically.
6.  **Domain**: Railway will give you a URL (e.g., `ai-agent-production.up.railway.app`). Update your Telnyx Webhook URL to this new domain.

---

## ✅ Option 2: Render (Alternative)
Similar to Railway, Render supports "Web Services" which are perfect for this app.

1.  **Sign up** at [render.com](https://render.com/)
2.  Click **New +** -> **Web Service**
3.  Connect your GitHub repo.
4.  **Runtime**: Node
5.  **Build Command**: `npm install && npm run build`
6.  **Start Command**: `npm start` (Make sure `npm start` points to `node dist/index.js`)
7.  **Environment**: Add your `.env` variables.

---

## ⚠️ Option 3: Vercel (If you strictly want Vercel)
If you must use Vercel, you will need to adapt the code to run as a Serverless Function, but **WebSockets will likely fail** or be very expensive/unstable.

To try deploying to Vercel, you need to add a `vercel.json` file:

**1. Create `vercel.json` in the root:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ]
}
```

**2. Update `package.json` scripts:**
Ensure you have a build script.

**3. Deploy:**
Import the repo in Vercel and add environment variables.

**Why this is risky:** The AI Agent needs to maintain a continuous connection with Telnyx for the duration of the call. Vercel functions will try to "sleep" or timeout, killing the call.

---

## 🎯 My Recommendation
**Use Railway or Render.** They offer a "Free Tier" or very cheap starting plans and will actually keep your WebSocket server running 24/7 without disconnecting your calls.
