# AI Calling Agent

A real-time AI voice assistant system built with Node.js, similar to ElevenLabs, Vapi, or OpenAI Realtime. This system handles phone calls and web-based voice interactions with low-latency streaming.

## 🎯 Features

- **Real-time Voice Conversations**: Streaming STT → LLM → TTS pipeline
- **Telephony Support**: Twilio integration for inbound/outbound calls
- **WebSocket Streaming**: Low-latency audio processing
- **Interruption Handling**: Detects when users interrupt the AI
- **Conversation Memory**: Maintains context throughout the call
- **Extensible Architecture**: Easy to add custom tools and actions

## 🏗️ Architecture

```
User (Phone/Web) → Twilio/WebRTC → WebSocket → Media Stream
                                                    ↓
                                              StreamManager
                                                    ↓
                                    ┌───────────────┼───────────────┐
                                    ↓               ↓               ↓
                                Deepgram         OpenAI       ElevenLabs
                                  (STT)          (LLM)          (TTS)
```

## 📦 Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify (high-performance web server)
- **STT**: Deepgram Nova-2 (real-time speech-to-text)
- **LLM**: OpenAI GPT-4o (conversation engine)
- **TTS**: ElevenLabs Turbo v2.5 (text-to-speech)
- **Telephony**: Twilio Media Streams

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18 or higher)
2. **API Keys**:
   - [Twilio](https://www.twilio.com/) (for phone calls)
   - [Deepgram](https://deepgram.com/) (for STT)
   - [OpenAI](https://platform.openai.com/) (for LLM)
   - [ElevenLabs](https://elevenlabs.io/) (for TTS)

### Installation

1. **Clone and Install Dependencies**:
```bash
cd ai-calling-agent
npm install
```

2. **Configure Environment Variables**:
Edit `.env` file with your API keys:
```env
PORT=3000
DOMAIN=your-ngrok-domain.ngrok-free.app

OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

3. **Build the Project**:
```bash
npm run build
```

4. **Start the Server**:
```bash
npm run dev
```

The server will start on `http://localhost:3000`.

### Exposing to the Internet (for Twilio)

Twilio needs a public URL to send webhooks. Use **ngrok**:

```bash
ngrok http 3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok-free.app`) and update:
1. Your `.env` file: `DOMAIN=abc123.ngrok-free.app`
2. Your Twilio phone number webhook: `https://abc123.ngrok-free.app/incoming`

### Making a Test Call

1. Call your Twilio phone number
2. You should hear: "Connecting you to the AI agent."
3. The AI will greet you and start the conversation!

## 📁 Project Structure

```
ai-calling-agent/
├── src/
│   ├── index.ts                 # Main server entry point
│   └── services/
│       ├── deepgram.ts          # STT service (Deepgram)
│       ├── openai.ts            # LLM service (OpenAI)
│       ├── elevenlabs.ts        # TTS service (ElevenLabs)
│       └── streamManager.ts     # Orchestrator (the "brain")
├── dist/                        # Compiled JavaScript (generated)
├── .env                         # Environment variables
├── package.json
└── tsconfig.json
```

## 🔧 How It Works

### 1. Call Flow
1. User calls Twilio number
2. Twilio sends webhook to `/incoming`
3. Server responds with TwiML to start a WebSocket stream
4. WebSocket connection established at `/media-stream`

### 2. Audio Processing Pipeline
1. **Incoming Audio**: Twilio sends mulaw-encoded audio chunks (base64)
2. **STT**: Audio sent to Deepgram for real-time transcription
3. **LLM**: Transcribed text sent to OpenAI for response generation
4. **TTS**: OpenAI response streamed to ElevenLabs for audio synthesis
5. **Outgoing Audio**: Audio sent back to Twilio → User hears response

### 3. Interruption Handling
- If user speaks while AI is talking, the system:
  - Detects the interruption via Voice Activity Detection (VAD)
  - Sends a `clear` event to Twilio to stop current audio
  - Processes the new user input

## 🛠️ Customization

### Change the AI Personality
Edit `src/services/streamManager.ts`:
```typescript
const systemPrompt = "You are a helpful, fast, and friendly AI voice assistant...";
```

### Add Custom Tools/Actions
In `src/services/openai.ts`, you can add function calling:
```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "check_inventory",
      description: "Check product inventory",
      parameters: { ... }
    }
  }
];
```

### Change Voice
Get a voice ID from ElevenLabs and update `.env`:
```env
ELEVENLABS_VOICE_ID=your-voice-id
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/incoming` | POST | Twilio webhook for incoming calls |
| `/media-stream` | WebSocket | Audio stream handler |

## 🐛 Troubleshooting

### "Deepgram Connection Closed"
- Check your `DEEPGRAM_API_KEY`
- Ensure you have credits in your Deepgram account

### "OpenAI Error"
- Verify `OPENAI_API_KEY` is valid
- Check your OpenAI usage limits

### "No audio from AI"
- Verify `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
- Check ElevenLabs quota

### Twilio not connecting
- Ensure ngrok is running
- Verify webhook URL in Twilio console matches your ngrok URL
- Check that `DOMAIN` in `.env` matches ngrok domain (without `https://`)

## 🚀 Deployment

### Production Deployment (AWS/GCP/Azure)

1. **Containerize**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

2. **Deploy** to your cloud provider
3. **Set up SSL** (required for WebSockets)
4. **Configure environment variables** in your cloud console

### Scaling Considerations
- Use **Redis** for session state (if running multiple instances)
- Implement **rate limiting** to protect API keys
- Monitor **latency** (target: <500ms end-to-end)

## 📈 Roadmap

- [ ] **Phase 1 (Week 1)**: ✅ MVP Complete
- [ ] **Phase 2 (Month 1)**: Web dashboard for configuration
- [ ] **Phase 3 (Month 2)**: Multi-tenant SaaS
- [ ] **Phase 4 (Month 3)**: RAG (knowledge base), analytics, SSO

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.

## 📄 License

ISC

## 🙏 Acknowledgments

Built with:
- [Fastify](https://www.fastify.io/)
- [Deepgram](https://deepgram.com/)
- [OpenAI](https://openai.com/)
- [ElevenLabs](https://elevenlabs.io/)
- [Twilio](https://www.twilio.com/)

---

**Need help?** Open an issue or check the [Developer Guide](./AI_CALLING_AGENT_BLUEPRINT.md) for detailed architecture information.
