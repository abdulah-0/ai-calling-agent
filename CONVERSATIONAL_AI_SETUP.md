# Real-Time Conversational AI - Setup Guide

## 🎯 Overview

Your AI Calling Agent now has **real-time conversational AI** capabilities, similar to Retell AI. The system enables natural two-way voice conversations between an AI agent and humans over the phone.

## 📋 Prerequisites

Before deploying, you need to obtain API keys for the following services:

### 1. Deepgram (Speech-to-Text)
- Sign up at: https://deepgram.com
- Get your API key from the dashboard
- Free tier available: 45,000 minutes/month

### 2. OpenAI (Conversation Intelligence)
- Ensure your OpenAI API key has sufficient quota
- Recommended model: `gpt-4-turbo-preview` or `gpt-3.5-turbo` (cheaper)

### 3. Telnyx (Already Configured)
- ✅ API Key: Already set
- ✅ Connection ID: Already set
- ✅ TeXML Application: Created

## 🔧 Environment Setup

Add these environment variables to your Render deployment:

```env
# Deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview

# Telnyx (already configured)
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id

# Application
WEBHOOK_URL=https://ai-calling-agent-q1qf.onrender.com
```

## 📞 Telnyx Configuration

### Update TeXML Webhook URL

In your Telnyx portal:

1. Go to **TeXML Applications**
2. Select your application
3. Set **Webhook URL** to:
   ```
   https://ai-calling-agent-q1qf.onrender.com/telnyx/inbound
   ```

4. Enable these webhook events:
   - ✅ `call.initiated`
   - ✅ `call.answered`
   - ✅ `call.hangup`
   - ✅ `call.speak.ended`

## 🗄️ Database Setup

Run this SQL in your Supabase SQL Editor to create the transcripts table:

```sql
-- Create call_transcripts table
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id),
  speaker TEXT CHECK (speaker IN ('human', 'ai')),
  text TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_call_transcripts_call_id ON call_transcripts(call_id);
CREATE INDEX idx_call_transcripts_timestamp ON call_transcripts(timestamp DESC);
```

## 🚀 Deployment Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Add real-time conversational AI with Deepgram and OpenAI"
git push origin main
```

### 2. Configure Render

1. Go to your Render dashboard
2. Select your service
3. Go to **Environment** tab
4. Add the new environment variables (DEEPGRAM_API_KEY, OPENAI_API_KEY, OPENAI_MODEL)
5. Click **Save Changes**
6. Render will automatically redeploy

### 3. Verify Deployment

Check Render logs for:
```
✅ Server running at http://localhost:3000
✅ Dashboard: http://localhost:3000/dashboard/
📡 WebSocket: ws://localhost:3000/ws/dashboard
```

## 🧪 Testing

### Test 1: Make a Call

1. Call your Telnyx phone number
2. You should hear: "Hello! I'm an AI assistant. How can I help you today?"
3. Speak naturally - the AI will respond
4. Have a conversation!

### Test 2: Check Logs

Monitor Render logs for:
```
📞 TeXML Inbound Event: call.initiated
📞 Incoming call from +1234567890
✅ Call answered: v3:xxx
🚀 Starting conversation loop for call xxx
🎤 Starting Deepgram live transcription...
✅ Deepgram connection opened
👤 User said: "Hello"
🤖 Generating AI response for: "Hello"
✅ AI response: "Hi there! How can I assist you today?"
```

### Test 3: Check Database

Query Supabase to see transcripts:
```sql
SELECT * FROM call_transcripts ORDER BY timestamp DESC LIMIT 10;
```

## 📊 How It Works

```
Incoming Call
    ↓
Telnyx TeXML
    ↓
/telnyx/inbound webhook
    ↓
ConversationLoop starts
    ↓
┌─────────────────────────────────┐
│  Conversation Loop              │
│  ┌──────────────────────────┐  │
│  │ 1. Deepgram STT          │  │
│  │    (Speech → Text)       │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │ 2. OpenAI GPT-4          │  │
│  │    (Generate Response)   │  │
│  └──────────────────────────┘  │
│            ↓                    │
│  ┌──────────────────────────┐  │
│  │ 3. Telnyx TTS            │  │
│  │    (Text → Speech)       │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
    ↓
Caller hears AI response
```

## 🎛️ Customization

### Change AI Personality

Edit `src/services/conversationLoop.ts`:

```typescript
const systemPrompt = ConversationEngine.createSystemPrompt('your custom purpose');
```

Or create a custom prompt:
```typescript
const customPrompt = `You are a friendly sales assistant for XYZ Company.
Your goal is to qualify leads and book appointments.
Be enthusiastic but professional.`;
```

### Change Greeting

Edit `src/index.ts` in the `/telnyx/inbound` handler:

```typescript
await conversationLoop.start("Your custom greeting here!");
```

### Adjust Response Length

Edit `src/services/conversationEngine.ts`:

```typescript
this.maxTokens = 150; // Increase for longer responses
```

## 💰 Cost Estimates

### Per 1000 Calls (avg 3 min each)

| Service | Usage | Cost |
|---------|-------|------|
| Telnyx | 3000 min | ~$30 |
| Deepgram | 3000 min | ~$36 |
| OpenAI GPT-4 | ~150K tokens | ~$450 |
| **Total** | | **~$516** |

### Cost Optimization

Use GPT-3.5-turbo instead of GPT-4:
```env
OPENAI_MODEL=gpt-3.5-turbo
```

**New cost**: ~$60/1000 calls (saves $390!)

## 🐛 Troubleshooting

### Issue: No response from AI

**Check:**
1. Deepgram API key is valid
2. OpenAI API key has quota
3. Render logs show "Deepgram connection opened"

### Issue: Call connects but no greeting

**Check:**
1. Telnyx webhook URL is correct
2. `/telnyx/inbound` endpoint is receiving events
3. Check Render logs for errors

### Issue: AI speaks but doesn't hear me

**Check:**
1. Deepgram is receiving audio
2. Check logs for "Speech started" events
3. Verify audio format (mulaw/8000Hz)

### Issue: Transcripts not saving

**Check:**
1. `call_transcripts` table exists in Supabase
2. Supabase credentials are correct
3. Check Render logs for database errors

## 📞 Support

If you encounter issues:

1. Check Render logs
2. Check Telnyx webhook logs
3. Verify all API keys are valid
4. Ensure database tables exist

## 🎉 Next Steps

1. ✅ Deploy to Render
2. ✅ Configure environment variables
3. ✅ Update Telnyx webhook URL
4. ✅ Create database tables
5. ✅ Make a test call
6. ✅ Monitor logs
7. ✅ Customize AI personality
8. ✅ Build live call monitoring dashboard (optional)

---

**Your AI Calling Agent is now ready for real-time conversations!** 🚀
