# Telnyx AI Calling Agent - Developer Blueprint

## 1. System Architecture (Telnyx-First)

### High-Level Architecture
```mermaid
graph TD
    User[User Phone] <-->|SIP/PSTN| Telnyx[Telnyx Cloud]
    Telnyx <-->|Call Control Webhooks| NodeServer[Node.js Server]
    Telnyx <-->|Media Stream (RTP)| NodeServer
    
    subgraph "AI Core"
        NodeServer -->|Audio Stream| VAD[VAD & Stream Manager]
        VAD -->|Audio| STT[Deepgram / Telnyx AI]
        STT -->|Text| LLM[OpenAI / Groq]
        LLM -->|Text| TTS[ElevenLabs / Telnyx AI]
        TTS -->|Audio| NodeServer
    end
    
    subgraph "Infrastructure"
        NodeServer <-->|State| Redis[Redis Cluster]
        NodeServer <-->|Jobs| Queue[BullMQ]
        NodeServer <-->|Data| DB[MongoDB]
    end
```

### Key Components
1.  **Telnyx Call Control**: The "brain" of the telephony. Handles inbound/outbound calls, transfers, and recording via Webhooks.
2.  **Media Streaming**: Bi-directional audio stream (PCMU/8000Hz) via WebSocket.
3.  **Stream Manager**: Orchestrates the audio flow, VAD (Voice Activity Detection), and interruption handling.
4.  **Redis**: Stores active call state (callLegId, streamId, conversation history) to allow distributed processing.

---

## 2. Technology Stack Recommendations

### Backend
-   **Runtime**: Node.js 20+ (TypeScript)
-   **Framework**: Fastify (Low latency) or Express (Ecosystem)
-   **Database**: MongoDB (Flexible schema for call logs/metadata)
-   **Cache**: Redis (Critical for real-time state)

### AI & Voice
-   **STT**: Deepgram Nova-2 (Best latency) or Telnyx Native STT
-   **LLM**: Groq (Llama 3.1 70B) for speed (<300ms) or GPT-4o for intelligence
-   **TTS**: ElevenLabs Turbo v2.5 (Quality) or Telnyx Native TTS (Cost/Speed)

### Infrastructure
-   **Containerization**: Docker
-   **Orchestration**: Kubernetes (K8s) for scaling >500 calls
-   **Queues**: BullMQ (Redis-based) for outbound dialers

---

## 3. Telnyx Integrations

### Setup Guide
1.  **Buy Number**: Purchase a DID in Telnyx Portal.
2.  **Create Application**: Go to "Call Control Applications", create new.
3.  **Webhook URL**: Point to `https://your-domain.com/telnyx/webhook`.
4.  **Assign Number**: Assign the DID to the Application.

### Outbound Dialing (Node.js)
```typescript
const telnyx = require('telnyx')(API_KEY);

async function makeCall(to: string) {
  const { data: call } = await telnyx.calls.create({
    connection_id: 'YOUR_CONNECTION_ID',
    to: to,
    from: '+1234567890',
    stream_url: 'wss://your-domain.com/media/telnyx',
    stream_track: 'inbound_track', // Stream audio TO the server
  });
}
```

### Handling Webhooks
```typescript
app.post('/telnyx/webhook', async (req, res) => {
  const event = req.body.data;
  if (event.event_type === 'call.initiated') {
    // Answer the call
    await telnyx.calls.answer({ call_control_id: event.payload.call_control_id });
  } else if (event.event_type === 'call.answered') {
    // Start media stream
    await telnyx.calls.fork_media_stream({
        call_control_id: event.payload.call_control_id,
        stream_url: 'wss://your-domain.com/media/telnyx',
        stream_track: 'both_tracks'
    });
  }
  res.status(200).send('ok');
});
```

---

## 4. Conversation Engine

### The Loop
1.  **Audio In**: Telnyx sends base64 PCMU audio via WebSocket.
2.  **Decoding**: Decode PCMU to PCM (16-bit).
3.  **VAD**: Detect speech. If user speaks, **CLEAR TTS BUFFER** (Barge-in).
4.  **STT**: Send audio to Deepgram.
5.  **LLM**: Stream text from LLM.
6.  **Tool Use**: If LLM requests tool (e.g., `book_meeting`), pause TTS, execute, feed result back to LLM.
7.  **TTS**: Stream text to ElevenLabs/Telnyx.
8.  **Encoding**: Encode PCM to PCMU.
9.  **Audio Out**: Send base64 PCMU to Telnyx WebSocket.

### Memory Management
-   **Short-term**: Redis `List` for current conversation turns.
-   **Long-term**: MongoDB/Vector DB for user preferences and past calls.

---

## 5. Voice Layer (Native vs ElevenLabs)

| Feature | Telnyx Native TTS | ElevenLabs |
| :--- | :--- | :--- |
| **Cost** | Low (~$0.001/min) | High (~$0.06/min) |
| **Latency** | Very Low (<200ms) | Low (~300ms) |
| **Quality** | Robotic/Standard | Human-like/Premium |
| **Streaming** | Yes | Yes |
| **Use Case** | IVR, Simple Notifs | Sales, Support, AI Agents |

**Recommendation**: Use ElevenLabs for the "Agent" persona. Use Telnyx for generic system messages if cost is a concern.

---

## 6. Pricing Calculations

### Telnyx (Estimated)
-   **Telephony**: $0.002/min (Inbound) / $0.005/min (Outbound)
-   **Phone Number**: $1.00/mo
-   **Media Streaming**: $0.004/min

### AI Costs
-   **STT (Deepgram)**: $0.0043/min
-   **LLM (Groq/OpenAI)**: ~$0.01/min
-   **TTS (ElevenLabs)**: ~$0.06/min (Enterprise rates lower)

### Total Cost Per Minute
-   **Low End (Telnyx AI)**: ~$0.02/min
-   **High End (ElevenLabs + GPT-4o)**: ~$0.10 - $0.15/min

### Comparison
| Stack | Cost/Min |
| :--- | :--- |
| Twilio + ElevenLabs | ~$0.15 |
| **Telnyx + ElevenLabs** | **~$0.10** |
| **Telnyx Native** | **~$0.02** |

---

## 7. Deployment & Scaling

### Horizontal Scaling
-   **Stateless Servers**: The Node.js server should be stateless.
-   **Redis**: Holds the mapping of `StreamID` -> `ServerInstance`.
-   **Load Balancer**: Nginx or AWS ALB to distribute WebSockets.

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Kubernetes
-   Use **Horizontal Pod Autoscaler (HPA)** based on CPU/Memory.
-   Use **Redis Cluster** for high availability.

---

## 8. Security + Compliance

-   **GDPR**: Encrypt call logs. Allow users to delete data.
-   **PCI-DSS**: Pause recording when collecting credit cards.
-   **Authentication**: Verify `Telnyx-Signature-Ed25519` header on webhooks.
-   **Rate Limiting**: Use Redis to limit calls per user/IP.

---

## 9. SaaS Blueprint

1.  **Onboarding**: User signs up -> Buys Number (via Telnyx API) -> Configures Agent.
2.  **Billing**: Stripe Metered Billing. Listen to webhook events (`call.hangup`) to calculate duration and charge Stripe.
3.  **Multi-tenancy**: `OrganizationID` in every database record.
4.  **Dashboard**:
    -   **Real-time**: WebSocket to frontend showing active calls.
    -   **Logs**: Table view of past calls with audio player.
    -   **Editor**: Drag-and-drop prompt builder.

---

## 10. Deliverables Checklist

-   [ ] `src/services/telnyx.ts` (Call Control)
-   [ ] `src/services/streamManager.ts` (Updated for Telnyx)
-   [ ] `src/services/billing.ts` (Stripe integration stub)
-   [ ] `Dockerfile` & `k8s/deployment.yaml`
-   [ ] `TELNYX_SETUP.md` (Step-by-step guide)
