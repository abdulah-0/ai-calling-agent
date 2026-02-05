import { createClient, LiveClient } from '@deepgram/sdk';
import EventEmitter from 'events';

export class DeepgramService extends EventEmitter {
    private deepgramLive: LiveClient | null = null;
    private apiKey: string;

    constructor() {
        super();
        this.apiKey = process.env.DEEPGRAM_API_KEY || '';
        if (!this.apiKey) {
            console.error('DEEPGRAM_API_KEY is missing');
        }
    }

    public connect() {
        const deepgram = createClient(this.apiKey);

        this.deepgramLive = deepgram.listen.live({
            model: 'nova-2',
            language: 'en-US',
            smart_format: true,
            encoding: 'mulaw', // Twilio uses mulaw
            sample_rate: 8000, // Twilio uses 8000Hz
            channels: 1,
            interim_results: true,
            endpointing: 300, // Silence duration to trigger end of utterance
            vad_events: true,
        });

        this.deepgramLive.on('open', () => {
            console.log('Deepgram Connection Opened');
            this.emit('open');
        });

        this.deepgramLive.on('close', () => {
            console.log('Deepgram Connection Closed');
            this.emit('close');
        });

        this.deepgramLive.on('transcriptReceived', (message) => {
            const data = JSON.parse(JSON.stringify(message)); // Ensure it's an object
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            const isFinal = data.is_final;

            if (transcript && transcript.trim().length > 0) {
                this.emit('transcription', { transcript, isFinal });
            }
        });

        this.deepgramLive.on('error', (error) => {
            console.error('Deepgram Error:', error);
            this.emit('error', error);
        });
    }

    public send(audioBuffer: Buffer) {
        if (this.deepgramLive && this.deepgramLive.getReadyState() === 1) { // 1 = OPEN
            this.deepgramLive.send(new Uint8Array(audioBuffer) as any);
        }
    }

    public disconnect() {
        if (this.deepgramLive) {
            this.deepgramLive.requestClose();
            this.deepgramLive = null;
        }
    }
}
