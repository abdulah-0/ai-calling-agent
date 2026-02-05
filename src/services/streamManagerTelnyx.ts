import { WebSocket } from 'ws';
import { TelnyxConversationalAI } from './telnyxConversationalAI';
import { OpenAIService } from './openai';
import { SupabaseService } from './supabase';

/**
 * StreamManager for 100% Telnyx Implementation
 * Uses Telnyx Conversational AI for STT + TTS
 */
export class StreamManagerTelnyx {
    private ws: WebSocket;
    private streamSid: string;
    private telnyxAI: TelnyxConversationalAI;
    private openai: OpenAIService;
    private supabase: SupabaseService;
    private isSpeaking: boolean = false;
    private callHistory: any[] = [];
    private callId: string | null = null;
    private callControlId: string | null = null;

    constructor(ws: WebSocket, callControlId?: string) {
        this.ws = ws;
        this.streamSid = '';
        this.callControlId = callControlId || null;

        // Initialize Services (Telnyx only)
        this.telnyxAI = new TelnyxConversationalAI();
        this.openai = new OpenAIService();
        this.supabase = new SupabaseService();

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // 1. Telnyx AI Events (STT)
        this.telnyxAI.on('transcription', async (data) => {
            const { transcript, isFinal } = data;
            console.log(`User: ${transcript}`);

            // Log to Supabase
            if (this.callId && isFinal) {
                await this.supabase.addMessage(this.callId, 'user', transcript);
            }

            // Interruption Logic
            if (this.isSpeaking) {
                console.log('Interruption detected! Clearing audio buffer.');
                this.sendClearMessage();
                this.isSpeaking = false;
            }

            if (isFinal) {
                // Send to LLM
                this.processUserMessage(transcript);
            }
        });

        // 2. LLM Events
        this.openai.on('token', (text) => {
            // Stream text to Telnyx TTS
            this.telnyxAI.sendText(text);
        });

        this.openai.on('complete', async (fullText) => {
            console.log(`AI: ${fullText}`);
            this.callHistory.push({ role: 'assistant', content: fullText });

            // Log to Supabase
            if (this.callId) {
                await this.supabase.addMessage(this.callId, 'assistant', fullText);
            }

            // Signal end of turn to Telnyx
            this.telnyxAI.endTurn();
        });

        // 3. Telnyx AI Events (TTS Audio)
        this.telnyxAI.on('audio', (audioBuffer: Buffer) => {
            this.isSpeaking = true;
            this.sendMediaMessage(audioBuffer);
        });

        // 4. Telnyx AI Events (User Speaking)
        this.telnyxAI.on('user_speaking', (speaking: boolean) => {
            console.log(`User speaking: ${speaking}`);
            if (speaking && this.isSpeaking) {
                // Barge-in detected
                this.sendClearMessage();
                this.isSpeaking = false;
            }
        });

        // 5. Telnyx AI Events (Interruption)
        this.telnyxAI.on('interruption', () => {
            console.log('Barge-in event from Telnyx');
            this.sendClearMessage();
            this.isSpeaking = false;
        });
    }

    public async start(streamSid: string, callControlId?: string, callId?: string) {
        this.streamSid = streamSid;
        this.callId = callId || null;

        // Update callControlId if provided
        if (callControlId) {
            this.callControlId = callControlId;
        }

        // Connect to Telnyx Conversational AI
        if (this.callControlId) {
            console.log(`Connecting to Telnyx AI with Call Control ID: ${this.callControlId}`);
            this.telnyxAI.connect(this.callControlId);
        } else {
            console.error('Cannot connect to Telnyx AI: Missing Call Control ID');
        }

        // Initial Greeting
        setTimeout(() => {
            this.processSystemMessage("Hello! I am your AI assistant. How can I help you today?");
        }, 1000);
    }

    public handleAudio(payload: string) {
        // Payload is base64 from Telnyx Media Stream
        const audioBuffer = Buffer.from(payload, 'base64');

        // Send to Telnyx Conversational AI for STT
        this.telnyxAI.sendAudio(audioBuffer);
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

        if (this.callId) {
            await this.supabase.addMessage(this.callId, 'assistant', text);
        }

        this.telnyxAI.sendText(text);
        this.telnyxAI.endTurn();
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

    public async stop() {
        this.telnyxAI.disconnect();

        // Generate call summary
        if (this.callId && this.callHistory.length > 0) {
            await this.generateCallSummary();
        }
    }

    private async generateCallSummary() {
        try {
            const transcript = this.callHistory
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            // Use LLM to generate summary
            const summaryPrompt = `Summarize this call conversation and extract key information:\n\n${transcript}`;
            const summary = await this.openai.generateSummary(summaryPrompt);

            // Save to Supabase
            if (this.callId) {
                await this.supabase.createCallSummary({
                    call_id: this.callId,
                    transcript,
                    summary,
                    sentiment: 'neutral', // Can be enhanced with sentiment analysis
                    lead_score: 0, // Can be enhanced with scoring logic
                    action_items: [],
                    extracted_data: {}
                });
            }
        } catch (error) {
            console.error('Error generating call summary:', error);
        }
    }
}
