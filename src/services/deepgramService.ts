import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import EventEmitter from 'events';

export interface TranscriptResult {
    text: string;
    isFinal: boolean;
    confidence: number;
    speaker?: string;
}

export class DeepgramService extends EventEmitter {
    private client: any;
    private liveTranscription: any;
    private isConnected: boolean = false;

    constructor() {
        super();
        const apiKey = process.env.DEEPGRAM_API_KEY;

        if (!apiKey) {
            console.error('❌ DEEPGRAM_API_KEY is missing');
            throw new Error('DEEPGRAM_API_KEY is required');
        }

        this.client = createClient(apiKey);
    }

    /**
     * Start live transcription stream
     */
    async startStream(options?: { encoding?: string; sampleRate?: number }): Promise<void> {
        try {
            console.log('🎤 Starting Deepgram live transcription...');

            // Default to mulaw for phone calls, but allow override for browser calls
            const encoding = options?.encoding || 'mulaw';
            const sampleRate = options?.sampleRate || 8000;

            console.log(`📊 Deepgram config: encoding=${encoding}, sampleRate=${sampleRate}`);

            this.liveTranscription = this.client.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                punctuate: true,
                interim_results: true,
                endpointing: 300, // ms of silence before finalizing
                vad_events: true, // Voice Activity Detection
                encoding: encoding as any,
                sample_rate: sampleRate,
                channels: 1
            });

            // Handle connection open
            this.liveTranscription.on(LiveTranscriptionEvents.Open, () => {
                console.log('✅ Deepgram connection opened');
                this.isConnected = true;
                this.emit('ready');
            });

            // Handle transcription results
            this.liveTranscription.on(LiveTranscriptionEvents.Transcript, (data: any) => {
                const transcript = data.channel?.alternatives?.[0];

                if (transcript && transcript.transcript) {
                    const result: TranscriptResult = {
                        text: transcript.transcript,
                        isFinal: data.is_final || false,
                        confidence: transcript.confidence || 0,
                        speaker: data.channel?.speaker || 'human'
                    };

                    // Emit transcript event
                    if (result.isFinal) {
                        console.log(`📝 Final transcript: "${result.text}"`);
                        this.emit('transcript', result);
                    } else {
                        console.log(`📝 Interim: "${result.text}"`);
                        this.emit('interim', result);
                    }
                }
            });

            // Handle voice activity detection
            this.liveTranscription.on(LiveTranscriptionEvents.SpeechStarted, () => {
                console.log('🎤 Speech started');
                this.emit('speech_start');
            });

            // Handle metadata
            this.liveTranscription.on(LiveTranscriptionEvents.Metadata, (data: any) => {
                console.log('📊 Deepgram metadata:', data);
            });

            // Handle errors
            this.liveTranscription.on(LiveTranscriptionEvents.Error, (error: any) => {
                console.error('❌ Deepgram error:', error);
                this.emit('error', error);
            });

            // Handle connection close
            this.liveTranscription.on(LiveTranscriptionEvents.Close, () => {
                console.log('🔌 Deepgram connection closed');
                this.isConnected = false;
                this.emit('close');
            });

        } catch (error) {
            console.error('❌ Failed to start Deepgram stream:', error);
            throw error;
        }
    }

    /**
     * Send audio data to Deepgram for transcription
     */
    sendAudio(audioData: Buffer): void {
        if (!this.isConnected || !this.liveTranscription) {
            console.warn('⚠️ Deepgram not connected, skipping audio');
            return;
        }

        try {
            this.liveTranscription.send(audioData);
        } catch (error) {
            console.error('❌ Error sending audio to Deepgram:', error);
            this.emit('error', error);
        }
    }

    /**
     * Finish the transcription stream
     */
    async finish(): Promise<void> {
        if (this.liveTranscription) {
            console.log('🛑 Finishing Deepgram stream...');
            this.liveTranscription.finish();
        }
    }

    /**
     * Close the connection
     */
    async close(): Promise<void> {
        if (this.liveTranscription) {
            console.log('🔌 Closing Deepgram connection...');
            await this.finish();
            this.isConnected = false;
        }
    }

    /**
     * Check if connected
     */
    isReady(): boolean {
        return this.isConnected;
    }
}
