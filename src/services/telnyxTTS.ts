import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TelnyxTTSConfig {
    voice?: string; // Default: AWS.Polly.Joanna-Neural
    sampleRate?: number; // Default: 24000
    encoding?: 'mp3' | 'pcm'; // Default: mp3
}

export class TelnyxTTSService extends EventEmitter {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private config: TelnyxTTSConfig;
    private isConnected: boolean = false;
    private audioQueue: Buffer[] = [];

    constructor(apiKey: string, config: TelnyxTTSConfig = {}) {
        super();
        this.apiKey = apiKey;
        this.config = {
            voice: config.voice || 'AWS.Polly.Joanna-Neural',
            sampleRate: config.sampleRate || 24000,
            encoding: config.encoding || 'mp3'
        };
    }

    async connect(): Promise<void> {
        // Correct Telnyx TTS WebSocket endpoint
        const wsUrl = `wss://api.telnyx.com/v2/text-to-speech/speech?voice=${encodeURIComponent(this.config.voice!)}`;

        this.ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        return new Promise((resolve, reject) => {
            this.ws!.on('open', () => {
                console.log(`✅ Telnyx TTS connected with voice: ${this.config.voice}`);
                this.isConnected = true;

                // Send initialization frame (space character)
                this.ws!.send(JSON.stringify({
                    type: 'text',
                    data: ' '
                }));

                resolve();
            });

            this.ws!.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());

                    if (message.type === 'audio') {
                        // Emit audio chunk (base64 encoded MP3)
                        const audioBuffer = Buffer.from(message.data, 'base64');
                        this.audioQueue.push(audioBuffer);
                        this.emit('audio', audioBuffer);
                    } else if (message.type === 'done') {
                        console.log('✅ TTS synthesis complete');
                        this.emit('done');
                    } else if (message.type === 'error') {
                        console.error('❌ TTS error:', message.message);
                        this.emit('error', new Error(message.message));
                    }
                } catch (err) {
                    console.error('Error parsing TTS message:', err);
                }
            });

            this.ws!.on('error', (error) => {
                console.error('❌ Telnyx TTS WebSocket error:', error);
                this.emit('error', error);
                reject(error);
            });

            this.ws!.on('close', () => {
                console.log('🔌 Telnyx TTS disconnected');
                this.isConnected = false;
                this.emit('close');
            });
        });
    }

    async synthesize(text: string): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('TTS not connected');
        }

        console.log(`🗣️ Synthesizing with ${this.config.voice}: "${text}"`);

        this.ws.send(JSON.stringify({
            type: 'text',
            data: text
        }));
    }

    async stop(): Promise<void> {
        if (this.ws) {
            // Send empty text to signal completion
            this.ws.send(JSON.stringify({
                type: 'text',
                data: ''
            }));

            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            this.audioQueue = [];
        }
    }

    changeVoice(voice: string): void {
        this.config.voice = voice;
        console.log(`🔄 Voice will change to: ${voice} on next connection`);
    }

    getAudioQueue(): Buffer[] {
        return this.audioQueue;
    }

    clearAudioQueue(): void {
        this.audioQueue = [];
    }
}
