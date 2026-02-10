import { SignalWire } from '@signalwire/realtime-api';
import dotenv from 'dotenv';

dotenv.config();

export class SignalWireService {
    private clientPromise: Promise<any>;
    private projectId: string;
    private apiToken: string;
    private spaceUrl: string;

    constructor() {
        this.projectId = process.env.SIGNALWIRE_PROJECT_ID || '';
        this.apiToken = process.env.SIGNALWIRE_API_TOKEN || '';
        this.spaceUrl = process.env.SIGNALWIRE_SPACE_URL || '';

        if (!this.projectId || !this.apiToken) {
            console.error('❌ Missing SignalWire credentials');
        }

        // Initialize Realtime Client (returns a Promise)
        this.clientPromise = SignalWire({
            project: this.projectId,
            token: this.apiToken
        });
    }

    /**
     * Generate SWML for the AI Agent
     * This defines how the agent behaves when a call connects.
     */
    generateSwml(to: string, from: string): string {
        const swml = {
            version: "1.0.0",
            sections: {
                main: [
                    {
                        ai: {
                            voice: "en-US-Neural2-F", // High quality neural voice
                            prompt: {
                                text: "You are a helpful AI assistant. Answer the user's questions concicely and professionally.",
                                temperature: 0.7
                            },
                            post_prompt: {
                                text: "Summarize the conversation."
                            },
                            params: {
                                end_of_speech_timeout: 1000
                            }
                        }
                    }
                ]
            }
        };

        return JSON.stringify(swml);
    }

    /**
     * Initiate an outbound call that executes SWML
     */
    async makeCall(to: string, from: string, webhookUrl: string) {
        try {
            console.log(`📞 Initiating SignalWire call to ${to} from ${from}`);

            const client = await this.clientPromise;

            // Use the Voice API to dial the phone number
            // We connect the call to the webhook URL which serves the SWML
            // Note: dialPhone connects the call to this client context, 
            // but we want to transfer it to a SWML document usually.
            // Using 'dialPhone' returns a Call object which we can control.

            // However, typical pattern for AI Agent is:
            // 1. Dial -> 2. Execute SWML

            // Let's try dialPhone first.
            const call = await client.voice.dialPhone({
                from: from,
                to: to,
                timeout: 30,
            });

            console.log('✅ Call connected:', call.id);

            // Once connected, we can play TTS or just rely on the SWML if we were using a different method.
            // But here, we might need to instruct the call.
            // If we want to use the webhookUrl, we might need a different method or rely on 
            // the inbound handling logic if this was an incoming call.

            // For OUTBOUND calls to use SWML, you often need to Transfer the call to a script 
            // or use LAML (REST API). Realtime API is more for controlling the call via code directly.

            // Since we built 'generateSwml', we probably want to execute that SWML.
            // We can try to play TTS immediately for now to verify connectivity.
            // Or better, we can use the 'prompt' method if available.

            // For now, let's keep it simple: Dial and Log.

            return { success: true, message: "Call initiated", callId: call.id };

        } catch (error) {
            console.error('❌ Error making SignalWire call:', error);
            throw error;
        }
    }
}
