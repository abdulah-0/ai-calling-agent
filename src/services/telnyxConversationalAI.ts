import WebSocket from 'ws';
import EventEmitter from 'events';

/**
 * Telnyx Conversational AI Service
 * Replaces Deepgram (STT) + ElevenLabs (TTS) with Telnyx's all-in-one solution
 */
export class TelnyxConversationalAI extends EventEmitter {
    private ws: WebSocket | null = null;
    private apiKey: string;
    private voiceType: 'natural' | 'natural_hd';
    private language: string;

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';
        this.voiceType = (process.env.TELNYX_VOICE_TYPE as 'natural' | 'natural_hd') || 'natural';
        this.language = process.env.TELNYX_LANGUAGE || 'en-US';

        if (!this.apiKey) {
            console.error('TELNYX_API_KEY is missing');
        }
    }

    public connect(callControlId: string) {
        // Telnyx Conversational AI WebSocket endpoint
        const url = `wss://rtc.telnyx.com/v2/conversational-ai?api_key=${this.apiKey}`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('Telnyx Conversational AI Connected');

            // Send initial configuration
            const config = {
                event: 'start',
                call_control_id: callControlId,
                config: {
                    voice: this.voiceType,
                    language: this.language,
                    enable_barge_in: true,
                    enable_turn_taking: true,
                    stream_audio: true
                }
            };

            this.ws?.send(JSON.stringify(config));
        });

        this.ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.event) {
                    case 'transcription':
                        // User speech transcribed
                        this.emit('transcription', {
                            transcript: message.transcript,
                            isFinal: message.is_final,
                            confidence: message.confidence
                        });
                        break;

                    case 'audio':
                        // TTS audio chunk
                        const audioBuffer = Buffer.from(message.audio, 'base64');
                        this.emit('audio', audioBuffer);
                        break;

                    case 'turn_start':
                        // User started speaking
                        this.emit('user_speaking', true);
                        break;

                    case 'turn_end':
                        // User stopped speaking
                        this.emit('user_speaking', false);
                        break;

                    case 'barge_in':
                        // User interrupted the agent
                        this.emit('interruption', message);
                        break;

                    case 'error':
                        console.error('Telnyx AI Error:', message.error);
                        this.emit('error', message.error);
                        break;
                }
            } catch (error) {
                console.error('Error parsing Telnyx AI message:', error);
            }
        });

        this.ws.on('error', (error) => {
            console.error('Telnyx AI WebSocket Error:', error);
            this.emit('error', error);
        });

        this.ws.on('close', () => {
            console.log('Telnyx Conversational AI Disconnected');
            this.emit('close');
        });
    }

    /**
     * Send audio from the call to Telnyx for STT
     */
    public sendAudio(audioBuffer: Buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'media',
                media: {
                    payload: audioBuffer.toString('base64')
                }
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send text to Telnyx for TTS (agent response)
     */
    public sendText(text: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'text',
                text: text,
                generate_audio: true
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Signal end of agent's turn
     */
    public endTurn() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'turn_complete'
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Update agent configuration mid-call
     */
    public updateConfig(config: {
        voice?: 'natural' | 'natural_hd';
        language?: string;
        enable_barge_in?: boolean;
    }) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'update_config',
                config
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
