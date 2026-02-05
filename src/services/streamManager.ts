import { WebSocket } from 'ws';
import { DeepgramService } from './deepgram';
import { OpenAIService } from './openai';
import { ElevenLabsService } from './elevenlabs';
import { SupabaseService } from './supabase';

export class StreamManager {
    private ws: WebSocket;
    private streamSid: string;
    private deepgram: DeepgramService;
    private openai: OpenAIService;
    private elevenlabs: ElevenLabsService;
    private supabase: SupabaseService;
    private isSpeaking: boolean = false;
    private callHistory: any[] = [];
    private callId: string | null = null;
    private callControlId: string | null = null;

    constructor(ws: WebSocket, callControlId?: string) {
        this.ws = ws;
        this.streamSid = '';
        this.callControlId = callControlId || null;

        // Initialize Services
        this.deepgram = new DeepgramService();
        this.openai = new OpenAIService();
        this.elevenlabs = new ElevenLabsService();
        this.supabase = new SupabaseService();

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // 1. STT Events
        this.deepgram.on('transcription', async (data) => {
            const { transcript, isFinal } = data;
            console.log(`User: ${transcript}`);

            // Interruption Logic
            if (this.isSpeaking) {
                console.log('Interruption detected! Clearing audio buffer.');
                this.sendClearMessage();
                this.isSpeaking = false;
                // Optional: Cancel OpenAI/ElevenLabs streams here
            }

            if (isFinal) {
                // Send to LLM
                this.processUserMessage(transcript);
            }
        });

        // 2. LLM Events
        this.openai.on('token', (text) => {
            // Stream text to TTS
            this.elevenlabs.sendText(text);
        });

        this.openai.on('complete', (fullText) => {
            console.log(`AI: ${fullText}`);
            this.callHistory.push({ role: 'assistant', content: fullText });
            this.elevenlabs.sendEOS(); // End of sentence/turn
        });

        // 3. TTS Events
        this.elevenlabs.on('audio', (audioBuffer: Buffer) => {
            this.isSpeaking = true;
            this.sendMediaMessage(audioBuffer);
        });
    }

    public start(streamSid: string) {
        this.streamSid = streamSid;
        this.deepgram.connect();
        this.elevenlabs.connect();

        // Initial Greeting
        setTimeout(() => {
            this.processSystemMessage("Hello! I am your AI assistant. How can I help you today?");
        }, 1000);
    }

    public handleAudio(payload: string) {
        // Payload is base64 from Twilio
        const audioBuffer = Buffer.from(payload, 'base64');
        this.deepgram.send(audioBuffer);
    }

    private async processUserMessage(text: string) {
        this.callHistory.push({ role: 'user', content: text });
        const systemPrompt = "You are a helpful, fast, and friendly AI voice assistant. Keep responses concise and conversational.";
        await this.openai.generateResponse(systemPrompt, text, this.callHistory);
    }

    private async processSystemMessage(text: string) {
        // Direct TTS for system messages (greetings, etc)
        console.log(`System: ${text}`);
        this.callHistory.push({ role: 'assistant', content: text });
        this.elevenlabs.sendText(text);
        this.elevenlabs.sendEOS();
    }

    private sendMediaMessage(audioBuffer: Buffer) {
        if (this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'media',
                media: {
                    payload: audioBuffer.toString('base64'),
                },
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    private sendClearMessage() {
        if (this.ws.readyState === WebSocket.OPEN) {
            const message = {
                event: 'clear',
                stream_id: this.streamSid,
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    public stop() {
        this.deepgram.disconnect();
        // this.elevenlabs.disconnect(); // logic to close
    }
}
