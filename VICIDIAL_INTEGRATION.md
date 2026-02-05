# VICIdial + SIP Integration Guide

This guide shows how to integrate the AI Calling Agent with VICIdial for enterprise-grade call center operations.

## Why VICIdial?

- **Cost-effective**: No per-minute charges like Twilio
- **Full control**: Self-hosted, customizable
- **Powerful dialer**: Predictive dialing, call blending
- **CRM integration**: Built-in lead management
- **Scalable**: Handle thousands of concurrent calls

## Architecture

```
┌──────────────┐
│   VICIdial   │
│   (Dialer)   │
└──────┬───────┘
       │ SIP
┌──────▼───────┐
│   Asterisk   │
│ (PBX/Switch) │
└──────┬───────┘
       │ ARI/WebSocket
┌──────▼───────────┐
│  Node.js Server  │
│  (AI Agent)      │
└──────────────────┘
```

## Prerequisites

- Ubuntu 20.04/22.04 server
- 4GB+ RAM
- Root access
- Public IP address

## Installation Steps

### 1. Install VICIdial

```bash
# Download installer
cd /usr/src
wget http://download.vicidial.com/beta-apps/vicidial_install.sh
chmod +x vicidial_install.sh

# Run installation (takes 30-60 minutes)
./vicidial_install.sh --without-dahdi
```

### 2. Configure Asterisk for AI Integration

Edit `/etc/asterisk/extensions.conf`:

```ini
[ai-inbound]
exten => _X.,1,Answer()
exten => _X.,2,Set(CHANNEL(hangup_handler_push)=hangup-handler,s,1)
exten => _X.,3,Stasis(ai-agent,${EXTEN})
exten => _X.,4,Hangup()

[ai-outbound]
exten => _X.,1,Set(CALLERID(num)=${CAMPAIGN_CID})
exten => _X.,2,Stasis(ai-agent,${EXTEN})
exten => _X.,3,Hangup()
```

### 3. Enable Asterisk ARI (REST Interface)

Edit `/etc/asterisk/ari.conf`:

```ini
[general]
enabled = yes
pretty = yes

[ai_user]
type = user
read_only = no
password = your_secure_password
```

Restart Asterisk:
```bash
asterisk -rx "core reload"
```

### 4. Install Node.js AI Server

On the same server or a separate one:

```bash
# Clone your AI agent
cd /opt
git clone <your-repo> ai-calling-agent
cd ai-calling-agent

# Install dependencies
npm install

# Configure .env
cp .env.example .env
nano .env
```

Add to `.env`:
```env
# Asterisk ARI
ARI_HOST=localhost
ARI_PORT=8088
ARI_USER=ai_user
ARI_PASSWORD=your_secure_password

# AI Services
DEEPGRAM_API_KEY=...
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

## Node.js Integration Code

### Create ARI Handler

Create `src/services/asterisk.ts`:

```typescript
import ari from 'ari-client';
import { StreamManager } from './streamManager';

export class AsteriskService {
  private client: any;
  private activeCalls: Map<string, StreamManager> = new Map();

  async connect() {
    const { ARI_HOST, ARI_PORT, ARI_USER, ARI_PASSWORD } = process.env;
    
    this.client = await ari.connect(
      `http://${ARI_HOST}:${ARI_PORT}`,
      ARI_USER!,
      ARI_PASSWORD!
    );

    console.log('Connected to Asterisk ARI');

    // Handle new calls
    this.client.on('StasisStart', this.handleCallStart.bind(this));
    this.client.on('StasisEnd', this.handleCallEnd.bind(this));
    
    this.client.start('ai-agent');
  }

  private async handleCallStart(event: any, channel: any) {
    console.log(`New call: ${channel.id}`);
    
    try {
      // Answer the call
      await channel.answer();
      
      // Create external media channel for audio streaming
      const externalMedia = this.client.Channel();
      
      await externalMedia.externalMedia({
        app: 'ai-agent',
        external_host: '127.0.0.1:9999', // Your WebSocket server
        format: 'ulaw',
        direction: 'both'
      });

      // Create bridge
      const bridge = this.client.Bridge();
      await bridge.create({ type: 'mixing' });
      
      // Add both channels to bridge
      await bridge.addChannel({ channel: [channel.id, externalMedia.id] });
      
      // Initialize AI stream manager
      const streamManager = new StreamManager(externalMedia);
      this.activeCalls.set(channel.id, streamManager);
      streamManager.start(channel.id);
      
    } catch (error) {
      console.error('Error handling call:', error);
      channel.hangup();
    }
  }

  private handleCallEnd(event: any, channel: any) {
    console.log(`Call ended: ${channel.id}`);
    
    const streamManager = this.activeCalls.get(channel.id);
    if (streamManager) {
      streamManager.stop();
      this.activeCalls.delete(channel.id);
    }
  }
}
```

### Update Main Server

Modify `src/index.ts`:

```typescript
import { AsteriskService } from './services/asterisk';

// ... existing code

// Initialize Asterisk connection
const asteriskService = new AsteriskService();
asteriskService.connect().catch(console.error);

// Keep existing Twilio/WebSocket routes for flexibility
```

## VICIdial Campaign Setup

### 1. Create Inbound Group

1. Login to VICIdial admin: `http://your-server/vicidial/admin.php`
2. Go to **Inbound → Add New Group**
3. Set:
   - **Group ID**: `AI_INBOUND`
   - **Group Name**: `AI Agent Inbound`
   - **Dial Method**: `RATIO`
   - **Extension**: Point to `ai-inbound` context

### 2. Create Outbound Campaign

1. Go to **Admin → Campaigns → Add New Campaign**
2. Set:
   - **Campaign ID**: `AI_OUTBOUND`
   - **Campaign Name**: `AI Agent Outbound`
   - **Dial Method**: `RATIO`
   - **Auto Dial Level**: `1.0`
   - **Dial Prefix**: Your context (e.g., `ai-outbound`)

### 3. Upload Leads

1. Go to **Lists → Add New List**
2. Upload CSV with columns: `phone_number`, `first_name`, `last_name`, etc.
3. Assign list to campaign

### 4. Start Dialing

```bash
# Start VICIdial dialer
/usr/share/astguiclient/AST_manager_listen.pl
/usr/share/astguiclient/AST_VDauto_dial.pl --debug
```

## Audio Streaming Options

### Option A: Asterisk ExternalMedia (Recommended)

Uses Asterisk 16+ ExternalMedia for direct RTP streaming:

```javascript
// In your WebSocket server
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  // Incoming RTP packets from Asterisk
  // Decode mulaw and send to Deepgram
  const pcmAudio = mulawDecode(msg);
  deepgram.send(pcmAudio);
});

server.bind(9999); // Match external_host port
```

### Option B: Asterisk AudioSocket

Install AudioSocket module:

```bash
cd /usr/src
git clone https://github.com/CyCoreSystems/audiosocket
cd audiosocket
make
make install
```

Configure in `extensions.conf`:

```ini
exten => _X.,1,Answer()
exten => _X.,2,AudioSocket(40325ec2-5efd-4bd3-805f-53576e581d13,localhost:9999)
```

## Monitoring & Debugging

### Check Asterisk Logs
```bash
tail -f /var/log/asterisk/full
```

### Check ARI Connection
```bash
curl -u ai_user:your_secure_password http://localhost:8088/ari/asterisk/info
```

### VICIdial Real-time Monitor
```bash
/usr/share/astguiclient/AST_manager_listen.pl --debug
```

## Production Considerations

### 1. Separate Servers
- **VICIdial/Asterisk**: Dedicated server for telephony
- **AI Server**: Separate server for AI processing
- Connect via private network

### 2. Load Balancing
```
┌──────────┐
│ VICIdial │
└────┬─────┘
     │
┌────▼─────────────┐
│  Load Balancer   │
│     (Nginx)      │
└────┬─────────────┘
     │
     ├──▶ AI Server 1
     ├──▶ AI Server 2
     └──▶ AI Server 3
```

### 3. Scaling
- **Asterisk**: Can handle 500-1000 concurrent calls per server
- **AI Servers**: Scale horizontally based on load
- **Database**: Use PostgreSQL with replication

### 4. Cost Savings
- **SIP Trunks**: Use providers like Twilio, Bandwidth, or local carriers
- **DIDs**: $1-2/month vs Twilio's higher rates
- **Per-minute**: $0.005-0.01 vs Twilio's $0.013

## Troubleshooting

### No Audio
1. Check firewall: Open ports 8088 (ARI), 9999 (RTP)
2. Verify codec: `asterisk -rx "core show codecs"`
3. Check logs: `/var/log/asterisk/full`

### Calls Not Connecting
1. Verify ARI credentials
2. Check Stasis app name matches
3. Test ARI: `curl http://localhost:8088/ari/channels`

### High Latency
1. Use local AI server (same datacenter as VICIdial)
2. Optimize network (dedicated VLAN)
3. Monitor with: `asterisk -rx "core show channels"`

## Next Steps

1. **Test with a single call** before scaling
2. **Monitor latency** (target: <500ms end-to-end)
3. **Set up call recording** for quality assurance
4. **Integrate with CRM** (VICIdial has built-in API)
5. **Add analytics dashboard** to track AI performance

---

For more details, see the [Developer Blueprint](./DEVELOPER_BLUEPRINT.md).
