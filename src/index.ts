import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { SignalWireService } from './services/signalwire';

dotenv.config();

const { PORT = 3000, SIGNALWIRE_SPACE_URL } = process.env;
const signalWireService = new SignalWireService();

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
        callsOverTime: stats.callsOverTime
    };
});

// API: Start Call (Trigger)
fastify.post('/api/calls/start', async (request, reply) => {
    try {
        const { to, from } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required field: to, from' });
        }

        console.log(`🚀 Initiating SignalWire call to ${to}`);

        // Use the current server's URL as the webhook for SWML
        // IN PRODUCTION: This must be a public URL (e.g. Render URL)
        const webhookUrl = `https://${request.hostname}/webhooks/signalwire`;

        const callData = await signalWireService.makeCall(to, from, webhookUrl);

        stats.totalCalls++;
        return reply.send({ success: true, status: 'initiated', call_data: callData });

    } catch (error: any) {
        console.error('Error starting call:', error);
        return reply.status(500).send({ error: error.message || 'Failed to start call' });
    }
});

// Webhook: SignalWire SWML Handler
// This endpoint is called by SignalWire when the call connects (Inbound or Outbound)
fastify.post('/webhooks/signalwire', async (request, reply) => {
    try {
        const { to, from } = request.body as any;
        console.log(`📝 Generatng SWML for call from ${from} to ${to}`);

        const swml = signalWireService.generateSwml(to, from);

        reply.header('Content-Type', 'application/json');
        return reply.send(swml);

    } catch (error) {
        console.error('Error generating SWML:', error);
        return reply.status(500).send({ error: 'Failed to generate SWML' });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`✅ Server running at http://localhost:${PORT}`);
        console.log(`✅ Dashboard: http://localhost:${PORT}/dashboard/`);
        console.log(`✅ SignalWire Webhook: http://localhost:${PORT}/webhooks/signalwire`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
