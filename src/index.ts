import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import { TelnyxService } from './services/telnyx';
import { StreamManagerTelnyx } from './services/streamManagerTelnyx';

dotenv.config();

const { PORT = 3000 } = process.env;
const telnyxService = new TelnyxService();

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
        callsOverTime: stats.callsOverTime
    };
});

// API: Start Call
fastify.post('/api/calls/start', async (request, reply) => {
    try {
        const { to, from } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        if (process.env.TELNYX_API_KEY) {
            await telnyxService.makeCall(to, from);
            return reply.send({ success: true, status: 'initiated', message: 'Call initiated via Telnyx' });
        } else {
            return reply.status(500).send({ error: 'TELNYX_API_KEY not configured' });
        }
    } catch (error: any) {
        console.error('Error starting call:', error);
        return reply.status(500).send({ error: error.message });
    }
});

// Store active conversation loops
const activeStreams = new Map<string, StreamManagerTelnyx>();

// Telnyx Webhook Handler
fastify.post('/webhooks/telnyx', async (request, reply) => {
    try {
        const event = request.body as any;
        const { event_type, payload } = event.data;

        console.log(`📨 Webhook: ${event_type}`);

        if (event_type === 'call.initiated') {
            console.log(`📞 Call initiated: ${payload.call_control_id}`);
            stats.totalCalls++;
            stats.activeCalls++;
        } else if (event_type === 'call.answered') {
            console.log(`✅ Call answered: ${payload.call_control_id}`);
            // Ensure media stream is started (handled by TelnyxService)
            await telnyxService.handleWebhook(event);
        } else if (event_type === 'call.hangup') {
            console.log(`📴 Call ended: ${payload.call_control_id}`);
            const stream = activeStreams.get(payload.call_control_id);
            if (stream) {
                await stream.stop();
                activeStreams.delete(payload.call_control_id);
            }
            stats.activeCalls = Math.max(0, stats.activeCalls - 1);
        } else {
            // Default handling
            await telnyxService.handleWebhook(event);
        }

        return reply.send({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});

// Media Stream WebSocket (for Telnyx audio)
fastify.register(async (fastify) => {
    fastify.get('/media/telnyx', { websocket: true }, (connection: any, req) => {
        console.log('📞 Telnyx media stream connected');

        let callControlId: string | null = null;
        let streamManager: StreamManagerTelnyx | null = null;

        connection.on('message', async (message: any) => {
            try {
                const text = message.toString();

                if (text.includes('"event":') || text.trim().startsWith('{')) {
                    try {
                        const data = JSON.parse(text);

                        if (data.event === 'start') {
                            callControlId = data.start.call_control_id;
                            console.log(`📞 Media stream started for: ${callControlId}`);

                            // Create new StreamManager for this call
                            streamManager = new StreamManagerTelnyx(connection, callControlId || undefined);
                            if (callControlId) {
                                activeStreams.set(callControlId, streamManager);
                            }

                            await streamManager.start(data.stream_id, callControlId, data.start.call_leg_id);

                        } else if (data.event === 'media' && streamManager) {
                            if (data.media && data.media.payload) {
                                streamManager.handleAudio(data.media.payload);
                            }
                        } else if (data.event === 'stop') {
                            console.log(`📞 Media stream stopped for: ${callControlId}`);
                            if (streamManager) {
                                await streamManager.stop();
                            }
                            streamManager = null;
                        }
                    } catch (e) {
                        // Ignore invalid JSON
                    }
                }
            } catch (error) {
                console.error('Error handling Telnyx media message:', error);
            }
        });

        connection.on('close', () => {
            console.log(`📞 Telnyx media stream closed for ${callControlId}`);
            if (streamManager) {
                streamManager.stop();
            }
        });
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`✅ Server running at http://localhost:${PORT}`);
        console.log(`✅ Dashboard: http://localhost:${PORT}/dashboard/`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
