import { Queue, Worker } from 'bullmq';
import { TelnyxService } from './telnyx';

export class QueueService {
    private callQueue: Queue;
    private telnyxService: TelnyxService;

    constructor(telnyxService: TelnyxService) {
        this.telnyxService = telnyxService;
        const redisConnection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
        };

        this.callQueue = new Queue('outbound-calls', { connection: redisConnection });

        // Worker to process jobs
        new Worker('outbound-calls', async (job) => {
            console.log(`Processing job ${job.id}: Calling ${job.data.to}`);
            try {
                await this.telnyxService.makeCall(job.data.to, job.data.from);
            } catch (error) {
                console.error(`Job ${job.id} failed:`, error);
                throw error;
            }
        }, { connection: redisConnection });
    }

    public async addCallJob(to: string, from: string, delay: number = 0) {
        await this.callQueue.add('make-call', { to, from }, { delay });
        console.log(`Added call job for ${to} with delay ${delay}ms`);
    }

    public async addCampaign(numbers: string[], from: string) {
        for (const number of numbers) {
            await this.addCallJob(number, from, Math.random() * 10000); // Stagger calls
        }
    }
}
