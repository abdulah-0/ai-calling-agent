import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';

dotenv.config();

const { PORT = 3000 } = process.env;

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

// API: Start Call (Simplified - no Telnyx for now)
fastify.post('/api/calls/start', async (request, reply) => {
    try {
        const { to, from } = request.body as any;

        if (!to || !from) {
            return reply.status(400).send({ error: 'Missing required fields: to, from' });
        }

        // Simulate call initiation
        const callId = `call_${Date.now()}`;
        stats.totalCalls++;

        console.log(`📞 Simulated call from ${from} to ${to}`);

        return reply.send({
            success: true,
            call_id: callId,
            status: 'initiated',
            message: 'Call simulated successfully (Telnyx integration pending)'
        });
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
        const { name, contacts } = request.body as any;

        if (!name || !contacts) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        const campaignId = `campaign_${Date.now()}`;

        return reply.send({
            success: true,
            campaign: {
                id: campaignId,
                name,
                total_contacts: contacts.length,
                status: 'created'
            }
        });
    } catch (error: any) {
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
        dashboardClients.add(connection.socket);

        connection.socket.on('close', () => {
            dashboardClients.delete(connection.socket);
            console.log('📊 Dashboard client disconnected');
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
