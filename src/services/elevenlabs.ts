import WebSocket from 'ws';
import EventEmitter from 'events';

export class ElevenLabsService extends EventEmitter {
    private ws: WebSocket | null = null;
    private voiceId: string;
    private apiKey: string;

    constructor() {
        super();
        this.apiKey = process.env.ELEVENLABS_API_KEY || '';
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'; // Default voice
    }

    public connect() {
        const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=eleven_turbo_v2_5&output_format=ulaw_8000`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('ElevenLabs Connected');
            // Send initial config
            const bosMessage = {
                text: " ",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                },
                xi_api_key: this.apiKey, // Send API key in the first message for WSS
            };
            this.ws?.send(JSON.stringify(bosMessage));
        });

        this.ws.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());

            if (response.audio) {
                const audioBuffer = Buffer.from(response.audio, 'base64');
                this.emit('audio', audioBuffer);
            }

            if (response.isFinal) {
                // End of stream for this segment
            }
        });

        this.ws.on('error', (error) => {
            console.error('ElevenLabs Error:', error);
        });

        this.ws.on('close', () => {
            console.log('ElevenLabs Disconnected');
        });
    }

    public sendText(text: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                text: text,
                try_trigger_generation: true,
            }));
        }
    }

    public sendEOS() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ text: "" })); // Empty string triggers flush
        }
    }
}
