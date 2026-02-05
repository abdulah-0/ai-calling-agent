import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import { TelnyxService } from './services/telnyx';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

dotenv.config();

const { PORT = 3000 } = process.env;
const telnyxService = new TelnyxService();
// Initialize Queue Service (lazy load to avoid Redis connection errors on startup if Redis is down)
let queueService: any = null;
import { QueueService } from './services/queue';
try {
    queueService = new QueueService(telnyxService);
    console.log('✅ QueueService initialized');
} catch (e) {
    console.error('⚠️ Failed to initialize QueueService (Redis might be down):', e);
}

// Stats tracking
let stats = {
    activeCalls: 0,
    totalCalls: 0,
    totalDuration: 0,
    totalCost: 0,
    callsOverTime: [] as any[]
};

const fastify = Fastify({
    logger: true
});

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Serve dashboard
fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../dashboard/public'),
    prefix: '/dashboard/',
});

// Redirect root to dashboard
fastify.get('/', async (request, reply) => {
    reply.redirect('/dashboard/');
});

// API: Get stats
fastify.get('/api/stats', async (request, reply) => {
    return {
        activeCalls: stats.activeCalls,
        totalCalls: stats.totalCalls,
        avgDuration: stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0,
        totalCost: stats.totalCost,
        avgCost: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
        llmCost: stats.totalCost * 0.25,
        avgLlmCost: stats.totalCalls > 0 ? (stats.totalCost * 0.25) / stats.totalCalls : 0,
        callsOverTime: stats.callsOverTime
    };
});

// API: Test Voice (Browser-based TTS using Telnyx)
fastify.post('/api/test/voice', async (request, reply) => {
    try {
        const { text, voice } = request.body as any;

        if (!text) {
            return reply.status(400).send({ error: 'Missing required field: text' });
        }

        console.log(`🧪 Generating voice sample with Telnyx: ${voice}`);

        // Use Telnyx Text-to-Speech API
        const response = await axios.post(
            'https://api.telnyx.com/v2/ai/generate/text_to_speech',
            {
                text: text,
                voice: voice || 'en-US-Neural2-A',
                language: 'en-US'
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        reply.header('Content-Type', 'audio/mpeg');
        return reply.send(Buffer.from(response.data));
    } catch (error: any) {
        console.error('Error generating voice:', error.response?.data || error.message);
        return reply.status(500).send({
            error: error.response?.data?.errors?.[0]?.detail || error.message
        });
    }
});

// API: Start Test Call
fastify.post('/api/test-call/start', async (request, reply) => {
    try {
        const { to, from, agentConfig } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        console.log(`🧪 Starting test call to ${to}`);

        // Make call with agent config in client state
        await telnyxService.makeCall(to, from, {
            type: 'test_call',
            agentConfig: agentConfig || {}
        });

        return reply.send({
            success: true,
            message: 'Test call initiated'
        });
    } catch (error: any) {
        console.error('Error starting test call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: Hangup Test Call
fastify.post('/api/test-call/hangup', async (request, reply) => {
    try {
        const { callControlId } = request.body as any;

        if (!callControlId) {
            return reply.status(400).send({ error: 'Missing callControlId' });
        }

        console.log(`🛑 Hanging up test call: ${callControlId}`);

        await telnyxService.hangupCall(callControlId);

        return reply.send({
            success: true,
            message: 'Call ended'
        });
    } catch (error: any) {
        console.error('Error hanging up call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: Get Call Transcript
fastify.get('/api/test-call/:callId/transcript', async (request, reply) => {
    try {
        const { callId } = request.params as any;
        const { SupabaseService } = await import('./services/supabase');
        const supabase = new SupabaseService();

        const transcripts = await supabase.client
            .from('call_transcripts')
            .select('*')
            .eq('call_id', callId)
            .order('timestamp', { ascending: true });

        return reply.send({
            success: true,
            messages: transcripts.data || []
        });
    } catch (error: any) {
        console.error('Error fetching transcript:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Store active conversation loops
const activeConversations = new Map<string, any>();

// TeXML Inbound Webhook Handler (for conversational AI)
fastify.post('/telnyx/inbound', async (request, reply) => {
    try {
        const event = request.body as any;
        const { event_type, payload } = event.data;

        console.log(`📞 TeXML Inbound Event: ${event_type}`);

        switch (event_type) {
            case 'call.initiated':
                console.log(`📞 Incoming call from ${payload.from}`);
                stats.totalCalls++;
                stats.activeCalls++;
                break;

            case 'call.answered':
                console.log(`✅ Call answered: ${payload.call_control_id}`);

                // Start conversation loop
                const { ConversationLoop } = await import('./services/conversationLoop');
                const { v4: uuidv4 } = await import('uuid');

                const callId = uuidv4();
                const conversationLoop = new ConversationLoop({
                    callId,
                    callControlId: payload.call_control_id,
                    callerPhone: payload.from,
                    purpose: 'customer support',
                    callType: 'phone'
                });

                // Store the conversation loop
                activeConversations.set(payload.call_control_id, conversationLoop);

                // Start the conversation
                await conversationLoop.start("Hello! How can I help you today?");

                // Listen for conversation events
                conversationLoop.on('error', (error) => {
                    console.error(`❌ Conversation error for ${payload.call_control_id}:`, error);
                });

                conversationLoop.on('stopped', () => {
                    console.log(`🛑 Conversation stopped for ${payload.call_control_id}`);
                    activeConversations.delete(payload.call_control_id);
                    stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                });

                break;

            case 'call.hangup':
                console.log(`📴 Call ended: ${payload.call_control_id}`);

                // Stop conversation loop
                const conversation = activeConversations.get(payload.call_control_id);
                if (conversation) {
                    await conversation.stop();
                    activeConversations.delete(payload.call_control_id);
                }

                stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                break;

            case 'call.speak.ended':
                console.log(`🗣️ Speech ended for ${payload.call_control_id}`);
                break;

            default:
                console.log(`📨 Unhandled event: ${event_type}`);
        }

        return reply.send({ received: true });
    } catch (error: any) {
        console.error('❌ TeXML webhook error:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Webhook: Telnyx
fastify.post('/webhooks/telnyx', async (request, reply) => {
    try {
        const event = request.body as any;
        const { event_type, payload } = event.data;

        console.log(`📨 Webhook: ${event_type}`);

        // Check for client state to identify test calls
        let clientState: any = null;
        if (payload.client_state) {
            try {
                const json = Buffer.from(payload.client_state, 'base64').toString('utf-8');
                clientState = JSON.parse(json);
            } catch (e) {
                console.error('Error parsing client_state:', e);
            }
        }

        if (clientState && clientState.type === 'voice_test') {
            console.log('🎤 Handling Voice Test Event');

            if (event_type === 'call.answered') {
                // Speak the text when answered
                await telnyxService.speak(
                    payload.call_control_id,
                    clientState.text,
                    clientState.voice
                );
            } else if (event_type === 'call.speak.ended') {
                // Hangup after speaking
                console.log('✅ Voice Test Complete. Hanging up.');
                await telnyxService.hangupCall(payload.call_control_id);
            }
        } else {
            // Normal call handling
            telnyxService.handleWebhook(event);
        }

        return reply.send({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});

// API: Start Call (Simplified)
fastify.post('/api/calls/start', async (request, reply) => {
    try {
        const { to, from } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        // Use real Telnyx service if available, else simulate
        if (process.env.TELNYX_API_KEY) {
            await telnyxService.makeCall(to, from);
            return reply.send({ success: true, status: 'initiated', message: 'Call initiated via Telnyx' });
        } else {
            // Simulate
            const callId = `call_${Date.now()}`;
            stats.totalCalls++;
            console.log(`📞 Simulated call from ${from} to ${to}`);
            return reply.send({ success: true, call_id: callId, status: 'initiated', message: 'Simulated call' });
        }
    } catch (error: any) {
        console.error('Error starting call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// API: List Calls
fastify.get('/api/calls', async (request, reply) => {
    return {
        calls: [],
        count: 0,
        message: 'Database integration pending'
    };
});

// API: Create Campaign
fastify.post('/api/campaigns', async (request, reply) => {
    try {
        const { name, contacts, agentConfig } = request.body as any;

        if (!name || !contacts || !Array.isArray(contacts)) {
            return reply.status(400).send({ error: 'Missing required fields or invalid contacts array' });
        }

        if (!queueService) {
            return reply.status(503).send({ error: 'Queue service not available (Redis down?)' });
        }

        const campaignId = `campaign_${Date.now()}`;
        const from = process.env.TELNYX_PHONE_NUMBER || '+15550000000';

        console.log(`🚀 Starting campaign "${name}" with ${contacts.length} contacts`);

        // Trigger campaign processing
        await queueService.addCampaign(contacts, from, agentConfig);

        return reply.send({
            success: true,
            campaign: {
                id: campaignId,
                name,
                total_contacts: contacts.length,
                status: 'processing',
                message: `Campaign started. Queued ${contacts.length} calls.`
            }
        });
    } catch (error: any) {
        console.error('Error creating campaign:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Dashboard WebSocket
const dashboardClients = new Set<any>();

function broadcastStats(data: any) {
    dashboardClients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        } catch (err) {
            console.error('Error broadcasting to client:', err);
        }
    });
}

fastify.register(async (fastify) => {
    fastify.get('/ws/dashboard', { websocket: true }, (connection: any, req) => {
        console.log('📊 Dashboard client connected');
        dashboardClients.add(connection);

        connection.on('close', () => {
            dashboardClients.delete(connection);
            console.log('📊 Dashboard client disconnected');
        });
    });
});

// Live Call WebSocket (for real-time transcription)
const liveCallClients = new Map<string, Set<any>>();

export function broadcastToLiveCall(callId: string, data: any) {
    const clients = liveCallClients.get(callId);
    if (clients) {
        clients.forEach(client => {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            } catch (err) {
                console.error('Error broadcasting to live call client:', err);
            }
        });
    }
}

fastify.register(async (fastify) => {
    fastify.get('/ws/live-call/:callId', { websocket: true }, (connection: any, req) => {
        const callId = (req.params as any).callId;
        console.log(`📞 Live call client connected for call: ${callId}`);

        // Add client to call-specific set
        if (!liveCallClients.has(callId)) {
            liveCallClients.set(callId, new Set());
        }
        liveCallClients.get(callId)!.add(connection);

        connection.on('close', () => {
            const clients = liveCallClients.get(callId);
            if (clients) {
                clients.delete(connection);
                if (clients.size === 0) {
                    liveCallClients.delete(callId);
                }
            }
            console.log(`📞 Live call client disconnected for call: ${callId}`);
        });

        // Send initial connection confirmation
        connection.send(JSON.stringify({
            type: 'connected',
            callId: callId
        }));
    });
});

// Browser Call WebSocket (for browser-based testing without phone)
import { ConversationLoop } from './services/conversationLoop';

const browserCallLoops = new Map<string, ConversationLoop>();
const browserCallClients = new Map<string, any>();

// Broadcast function for browser calls
export function broadcastToBrowserCall(callId: string, data: any) {
    const client = browserCallClients.get(callId);
    if (client) {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        } catch (err) {
            console.error('Error broadcasting to browser call client:', err);
        }
    }
}

fastify.register(async (fastify) => {
    fastify.get('/ws/browser-call', { websocket: true }, (connection: any, req) => {
        const callId = uuidv4();
        console.log(`🌐 Browser call client connected: ${callId}`);

        // Store client for broadcasting
        browserCallClients.set(callId, connection);

        let conversationLoop: ConversationLoop | null = null;

        // Custom speak handler that sends text to browser
        const onSpeak = async (text: string) => {
            try {
                console.log(`🗣️ Sending AI response to browser: "${text}"`);
                if (connection.readyState === WebSocket.OPEN) {
                    connection.send(JSON.stringify({
                        type: 'speak',
                        data: { text }
                    }));
                }
            } catch (err) {
                console.error('Error sending speak to browser:', err);
            }
        };

        // Handle incoming messages from browser
        connection.on('message', async (message: any) => {
            try {
                // Check if it's JSON (control message) or binary (audio)
                if (typeof message === 'string' || message instanceof Buffer) {
                    let data;
                    try {
                        data = JSON.parse(message.toString());
                    } catch {
                        // If not JSON, treat as audio data
                        if (conversationLoop) {
                            const audioBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
                            await conversationLoop.processAudio(audioBuffer);
                        }
                        return;
                    }

                    if (data.type === 'start') {
                        console.log(`🚀 Starting browser call conversation for ${callId}`);
                        try {
                            // Start conversation loop
                            conversationLoop = new ConversationLoop({
                                callId,
                                callControlId: callId, // Use callId as fake control ID
                                callerPhone: 'browser',
                                greeting: data.greeting,
                                voice: data.voice || 'AWS.Polly.Joanna-Neural', // Allow voice selection
                                onSpeak,
                                callType: 'browser'
                            });

                            // Listen for TTS audio chunks
                            conversationLoop.on('tts-audio', (audioChunk: Buffer) => {
                                try {
                                    if (connection.readyState === WebSocket.OPEN) {
                                        connection.send(JSON.stringify({
                                            type: 'audio',
                                            data: audioChunk.toString('base64')
                                        }));
                                    }
                                } catch (err) {
                                    console.error('Error sending TTS audio:', err);
                                }
                            });

                            browserCallLoops.set(callId, conversationLoop);

                            console.log('📞 ConversationLoop created, starting...');
                            await conversationLoop.start(data.greeting);
                            console.log('✅ ConversationLoop started successfully');

                            connection.send(JSON.stringify({
                                type: 'started',
                                callId
                            }));
                        } catch (startError) {
                            console.error('❌ Error starting conversation loop:', startError);
                            console.error('Stack trace:', startError instanceof Error ? startError.stack : 'No stack trace');

                            // Send error to client
                            connection.send(JSON.stringify({
                                type: 'error',
                                error: `Failed to start conversation: ${startError instanceof Error ? startError.message : 'Unknown error'}`
                            }));

                            // Clean up
                            if (conversationLoop) {
                                try {
                                    await conversationLoop.stop();
                                } catch (stopError) {
                                    console.error('Error stopping conversation loop:', stopError);
                                }
                            }
                            browserCallLoops.delete(callId);
                            browserCallClients.delete(callId);
                        }

                    } else if (data.type === 'audio' && conversationLoop) {
                        // Process base64 encoded audio from browser
                        console.log('🎤 Received audio chunk, base64 length:', data.audio?.length || 0);
                        const audioBuffer = Buffer.from(data.audio, 'base64');
                        console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
                        await conversationLoop.processAudio(audioBuffer);
                        console.log('✅ Audio processed by ConversationLoop');

                    } else if (data.type === 'stop' && conversationLoop) {
                        console.log(`🛑 Stopping browser call ${callId}`);
                        // Stop conversation
                        await conversationLoop.stop();
                        browserCallLoops.delete(callId);
                        browserCallClients.delete(callId);
                        conversationLoop = null;
                    }
                }

            } catch (err) {
                console.error('Error handling browser call message:', err);
                connection.send(JSON.stringify({
                    type: 'error',
                    error: err instanceof Error ? err.message : 'Unknown error'
                }));
            }
        });

        connection.on('close', async () => {
            console.log(`🌐 Browser call client disconnected: ${callId}`);
            if (conversationLoop) {
                await conversationLoop.stop();
                browserCallLoops.delete(callId);
            }
            browserCallClients.delete(callId);
        });

        // Send initial connection confirmation
        connection.send(JSON.stringify({
            type: 'connected',
            callId
        }));
    });
});

// Media Stream WebSocket (for Telnyx audio)
fastify.register(async (fastify) => {
    fastify.get('/media/telnyx', { websocket: true }, (connection: any, req) => {
        console.log('📞 Telnyx media stream connected');

        let callControlId: string | null = null;
        let conversationLoop: any = null;

        connection.on('message', async (message: any) => {
            try {
                // Parse message (Telnyx sends JSON string)
                const text = message.toString();

                // Some events are JSON, media payload might be wrapped or separate
                if (text.includes('"event":') || text.trim().startsWith('{')) {
                    try {
                        const data = JSON.parse(text);

                        if (data.event === 'start') {
                            callControlId = data.start.call_control_id;
                            console.log(`📞 Media stream started for: ${callControlId}`);

                            // Find active conversation loop
                            if (callControlId) {
                                conversationLoop = activeConversations.get(callControlId);
                                if (!conversationLoop) {
                                    console.warn(`⚠️ No active conversation found for ${callControlId}`);
                                } else {
                                    console.log(`✅ Attached to conversation loop for ${callControlId}`);
                                }
                            }
                        } else if (data.event === 'media' && conversationLoop) {
                            // Extract payload (PCMU/8000 encoded in base64)
                            if (data.media && data.media.payload) {
                                const audioBuffer = Buffer.from(data.media.payload, 'base64');
                                await conversationLoop.processAudio(audioBuffer);
                            }
                        } else if (data.event === 'stop') {
                            console.log(`📞 Media stream stopped for: ${callControlId}`);
                            conversationLoop = null;
                        }
                    } catch (e) {
                        // Ignore if not valid JSON
                    }
                }
            } catch (error) {
                console.error('Error handling Telnyx media message:', error);
            }
        });

        connection.on('close', () => {
            console.log(`📞 Telnyx media stream closed for ${callControlId}`);
        });
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`✅ Server running at http://localhost:${PORT}`);
        console.log(`✅ Dashboard: http://localhost:${PORT}/dashboard/`);
        console.log(`📡 WebSocket: ws://localhost:${PORT}/ws/dashboard`);

        // Start simulation mode AFTER server is ready
        if (process.env.SIMULATION_MODE === 'true') {
            console.log('🎭 Starting Simulation Mode...');
            setInterval(() => {
                if (Math.random() > 0.7) {
                    stats.activeCalls++;
                    stats.totalCalls++;
                    broadcastStats({ type: 'call_started' });

                    setTimeout(() => {
                        stats.activeCalls = Math.max(0, stats.activeCalls - 1);
                        stats.totalDuration += Math.floor(Math.random() * 300);
                        stats.totalCost += 0.05 + (Math.random() * 0.5);
                        broadcastStats({ type: 'call_ended' });
                    }, Math.random() * 10000 + 5000);
                }

                const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const existingEntry = stats.callsOverTime.find(d => d.date === today);
                if (existingEntry) {
                    existingEntry.count = stats.totalCalls;
                } else {
                    stats.callsOverTime.push({ date: today, count: stats.totalCalls });
                }
            }, 5000);
        }
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
