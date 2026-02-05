# 🚀 Quick Start Checklist

Use this checklist to get your AI Calling Agent running in under 30 minutes.

## ☐ Step 1: Get API Keys (15 min)

### Required Services

- [ ] **Deepgram** (STT)
  - Sign up: https://console.deepgram.com/signup
  - Get API key from dashboard
  - Free tier: $200 credit

- [ ] **OpenAI** (LLM)
  - Sign up: https://platform.openai.com/signup
  - Create API key: https://platform.openai.com/api-keys
  - Add $10+ credit to account

- [ ] **ElevenLabs** (TTS)
  - Sign up: https://elevenlabs.io/sign-up
  - Get API key from profile
  - Get voice ID from "Voices" page (or use default)
  - Free tier: 10,000 characters/month

### Choose ONE Telephony Option

**Option A: Twilio (Easiest)**
- [ ] Sign up: https://www.twilio.com/try-twilio
- [ ] Get Account SID and Auth Token from console
- [ ] Buy a phone number ($1)
- [ ] Note: Costs $0.013/min for calls

**Option B: VICIdial (Cheaper at scale)**
- [ ] Skip for now (use Twilio for testing)
- [ ] See VICIDIAL_INTEGRATION.md when ready

## ☐ Step 2: Configure Environment (2 min)

```bash
cd ai-calling-agent
```

Edit `.env` file:

```env
# Server
PORT=3000
DOMAIN=                    # Leave empty for now

# AI Services
OPENAI_API_KEY=sk-...      # ← Paste your key
DEEPGRAM_API_KEY=...       # ← Paste your key
ELEVENLABS_API_KEY=...     # ← Paste your key
ELEVENLABS_VOICE_ID=...    # ← Paste voice ID (or use default)

# Twilio (if using)
TWILIO_ACCOUNT_SID=...     # ← Paste if using Twilio
TWILIO_AUTH_TOKEN=...      # ← Paste if using Twilio
TWILIO_PHONE_NUMBER=...    # ← Your Twilio number
```

## ☐ Step 3: Install & Build (3 min)

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run dev
```

You should see:
```
Server listening on http://localhost:3000
```

## ☐ Step 4: Expose to Internet (2 min)

Twilio needs a public URL. Use ngrok:

```bash
# In a new terminal
ngrok http 3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok-free.app`)

Update `.env`:
```env
DOMAIN=abc123.ngrok-free.app
```

Restart your server (Ctrl+C, then `npm run dev`)

## ☐ Step 5: Configure Twilio Webhook (3 min)

1. Go to Twilio Console: https://console.twilio.com/
2. Click **Phone Numbers** → **Manage** → **Active Numbers**
3. Click your phone number
4. Scroll to **Voice Configuration**
5. Set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok-free.app/incoming`
   - **HTTP**: POST
6. Click **Save**

## ☐ Step 6: Make Your First Call! (1 min)

1. Call your Twilio phone number from your mobile
2. You should hear: "Connecting you to the AI agent."
3. The AI will greet you: "Hello! I am your AI assistant..."
4. **Start talking!**

## ✅ Success Checklist

- [ ] Server started without errors
- [ ] ngrok is running and showing requests
- [ ] Twilio webhook configured
- [ ] Called the number and heard the greeting
- [ ] AI responded to your voice
- [ ] You can interrupt the AI (it stops talking when you speak)

## 🐛 Troubleshooting

### "Deepgram Connection Closed"
- ✅ Check `DEEPGRAM_API_KEY` is correct
- ✅ Verify you have credits: https://console.deepgram.com/billing

### "OpenAI Error: 401"
- ✅ Check `OPENAI_API_KEY` is correct
- ✅ Verify you have credits: https://platform.openai.com/usage

### "No audio from AI"
- ✅ Check `ELEVENLABS_API_KEY` is correct
- ✅ Check `ELEVENLABS_VOICE_ID` is valid
- ✅ Verify quota: https://elevenlabs.io/subscription

### "Twilio webhook failed"
- ✅ Ensure ngrok is running
- ✅ Check webhook URL matches ngrok URL
- ✅ Verify `DOMAIN` in `.env` is correct (no `https://`)
- ✅ Check Twilio debugger: https://console.twilio.com/monitor/debugger

### "Server won't start"
- ✅ Run `npm install` again
- ✅ Check Node.js version: `node -v` (should be 18+)
- ✅ Check for port conflicts: `netstat -ano | findstr :3000`

## 📊 Monitor Your Call

While on the call, watch your terminal. You should see:

```
Client connected to media stream
Media stream started abc123...
Deepgram Connection Opened
ElevenLabs Connected
User: Hello
AI: Hello! How can I help you today?
```

## 🎯 Next Steps

Once you have a working call:

### Customize the AI
Edit `src/services/streamManager.ts` line 85:
```typescript
const systemPrompt = "You are a helpful AI assistant...";
```

Change to:
```typescript
const systemPrompt = "You are a sales assistant for Acme Corp. Be enthusiastic and helpful.";
```

Rebuild and restart:
```bash
npm run build
npm run dev
```

### Change the Voice
1. Go to ElevenLabs: https://elevenlabs.io/voice-library
2. Choose a voice and copy its ID
3. Update `.env`: `ELEVENLABS_VOICE_ID=new-voice-id`
4. Restart server

### Add Call Recording
See DEVELOPER_BLUEPRINT.md section on "Call Recording"

### Scale to Production
See DEVELOPER_BLUEPRINT.md section on "Deployment"

## 💡 Pro Tips

1. **Test locally first**: Use a WebSocket client to test before Twilio
2. **Monitor costs**: Check your API dashboards daily
3. **Keep responses short**: Voice conversations work best with concise replies
4. **Use interruption**: The AI should stop talking when you speak (this is built-in)
5. **Log everything**: Check your terminal for debugging info

## 🎉 Congratulations!

You now have a working AI calling agent! 

**What you can do next:**
- Integrate with your CRM
- Add custom tools/actions
- Build a web dashboard
- Deploy to production
- Scale to handle 100+ concurrent calls

See **DEVELOPER_BLUEPRINT.md** for advanced features.

---

**Need help?** Check the troubleshooting section or review the logs in your terminal.
