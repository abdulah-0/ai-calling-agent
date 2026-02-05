import Redis from 'ioredis';

export class RedisService {
    private client: Redis;

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = new Redis(redisUrl, {
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn('Redis connection failed after 3 attempts. Running without Redis.');
                    return null; // Stop retrying
                }
                return Math.min(times * 100, 3000);
            }
        });

        this.client.on('error', (err) => {
            console.warn('Redis Error (non-fatal):', err.message);
        });

        this.client.on('connect', () => {
            console.log('Redis Connected');
        });

        // Try to connect but don't block server startup
        this.client.connect().catch(err => {
            console.warn('Redis not available. Continuing without Redis:', err.message);
        });
    }

    // Store mapping between Call Control ID and Stream ID
    public async setCallStreamMapping(callControlId: string, streamId: string) {
        await this.client.set(`call:${callControlId}:stream`, streamId, 'EX', 3600); // 1 hour expiry
    }

    public async getStreamId(callControlId: string): Promise<string | null> {
        return await this.client.get(`call:${callControlId}:stream`);
    }

    // Store conversation history
    public async addMessageToHistory(callControlId: string, role: 'user' | 'assistant', content: string) {
        const message = JSON.stringify({ role, content, timestamp: Date.now() });
        await this.client.rpush(`history:${callControlId}`, message);
        await this.client.expire(`history:${callControlId}`, 86400); // 24 hour expiry
    }

    public async getHistory(callControlId: string): Promise<any[]> {
        const history = await this.client.lrange(`history:${callControlId}`, 0, -1);
        return history.map(msg => JSON.parse(msg));
    }

    // Store active call metadata
    public async setActiveCall(callControlId: string, metadata: any) {
        await this.client.hset(`active_call:${callControlId}`, metadata);
        await this.client.expire(`active_call:${callControlId}`, 3600);
    }

    public async getActiveCall(callControlId: string) {
        return await this.client.hgetall(`active_call:${callControlId}`);
    }

    public async removeActiveCall(callControlId: string) {
        await this.client.del(`active_call:${callControlId}`);
        await this.client.del(`call:${callControlId}:stream`);
    }

    // Generic Redis methods for conversation state
    public async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    public async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.set(key, value, 'EX', ttl);
        } else {
            await this.client.set(key, value);
        }
    }

    public async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    public async keys(pattern: string): Promise<string[]> {
        return await this.client.keys(pattern);
    }
}
