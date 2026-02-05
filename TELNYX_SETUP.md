# Telnyx Setup Guide

## Prerequisites
- Telnyx Account (sign up at https://telnyx.com)
- Node.js 20+
- Redis (local or cloud)

## Step 1: Create Telnyx Account & Get API Key

1. Go to https://portal.telnyx.com/#/login/sign-up
2. Complete registration
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `KEY...`)

## Step 2: Purchase a Phone Number

1. In Telnyx Portal, go to **Numbers** → **Buy Numbers**
2. Search for a number in your desired location
3. Click **Buy** on your chosen number
4. Note down the phone number

## Step 3: Create a Call Control Application

1. Go to **Voice** → **Call Control Applications**
2. Click **Create New Application**
3. Set the following:
   - **Application Name**: AI Calling Agent
   - **Webhook URL**: `https://your-domain.com/telnyx/webhook`
   - **Webhook API Version**: V2
   - **Failover URL**: (optional)
4. Click **Save**
5. Copy the **Connection ID**

## Step 4: Assign Number to Application

1. Go to **Numbers** → **My Numbers**
2. Click on your purchased number
3. Under **Voice Settings**:
   - Set **Connection** to your Call Control Application
4. Click **Save**

## Step 5: Configure Environment Variables

Update your `.env` file:

```env
# Telnyx
TELNYX_API_KEY=KEYxxxxxxxxxxxxxxxxxxxxx
TELNYX_CONNECTION_ID=xxxxxxxxxxxxxxxxxxxxx
TELNYX_PHONE_NUMBER=+1234567890

# Domain (for webhooks)
DOMAIN=your-domain.com

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Existing AI Services
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## Step 6: Expose Your Server

### Option A: Using ngrok (Development)
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Option B: Production Deployment
Deploy to a cloud provider with a public domain.

## Step 7: Update Telnyx Webhook

1. Go back to your Call Control Application
2. Update **Webhook URL** to: `https://your-ngrok-or-domain.com/telnyx/webhook`
3. Save

## Step 8: Start the Server

```bash
# Install dependencies
npm install

# Build
npm run build

# Start
npm run dev
```

## Step 9: Test Inbound Call

1. Call your Telnyx number
2. You should hear: "Connecting you to the AI agent"
3. The AI will greet you
4. Speak to test the conversation

## Step 10: Test Outbound Call (Optional)

Use the API to trigger an outbound call:

```bash
curl -X POST http://localhost:3000/api/call/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "from": "+your-telnyx-number"
  }'
```

## Troubleshooting

### Webhook Not Receiving Events
- Verify ngrok is running
- Check Telnyx webhook URL is correct
- Ensure server is running on port 3000

### Audio Issues
- Verify Deepgram and ElevenLabs API keys
- Check audio format is `ulaw_8000`

### Call Fails Immediately
- Verify `TELNYX_CONNECTION_ID` is correct
- Check phone number is assigned to the application

## Cost Estimation

| Service | Cost/Min | Notes |
|---------|----------|-------|
| Telnyx Telephony | $0.002-$0.005 | Inbound/Outbound |
| Telnyx Media Streaming | $0.004 | Bi-directional audio |
| Deepgram STT | $0.0043 | Nova-2 model |
| OpenAI LLM | ~$0.01 | GPT-4o streaming |
| ElevenLabs TTS | ~$0.06 | Turbo v2.5 |
| **Total** | **~$0.08-$0.10/min** | Full stack |

## Next Steps

- Set up Redis for production
- Configure BullMQ for outbound campaigns
- Deploy with Docker/Kubernetes
- Add call recording
- Implement analytics dashboard
