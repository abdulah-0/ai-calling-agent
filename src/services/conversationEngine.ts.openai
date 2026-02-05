import OpenAI from 'openai';
import EventEmitter from 'events';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

export interface ConversationContext {
    callId: string;
    messages: Message[];
    systemPrompt: string;
    metadata: {
        callerPhone?: string;
        callPurpose: string;
        startTime: Date;
    };
}

export class ConversationEngine extends EventEmitter {
    private openai: OpenAI;
    private model: string;
    private maxTokens: number;
    private temperature: number;

    constructor() {
        super();

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('❌ OPENAI_API_KEY is missing');
            throw new Error('OPENAI_API_KEY is required');
        }

        this.openai = new OpenAI({ apiKey });
        // Using gpt-4o (latest model as of Dec 2024)
        this.model = process.env.OPENAI_MODEL || 'gpt-4o';
        this.maxTokens = 150; // Keep responses concise for natural conversation
        this.temperature = 0.7; // Balance between creativity and consistency
    }

    /**
     * Generate AI response based on conversation context
     */
    async generateResponse(context: ConversationContext, userMessage: string): Promise<string> {
        try {
            console.log(`🤖 Generating AI response for: "${userMessage}"`);

            // Add user message to context
            const messages: Message[] = [
                { role: 'system', content: context.systemPrompt },
                ...context.messages,
                { role: 'user', content: userMessage, timestamp: new Date() }
            ];

            // Keep only last 10 messages to manage context window
            const recentMessages = messages.slice(-11); // 1 system + 10 conversation messages

            // Call OpenAI API
            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: recentMessages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                stream: false
            });

            const response = completion.choices[0]?.message?.content || '';

            if (!response) {
                throw new Error('Empty response from OpenAI');
            }

            console.log(`✅ AI response: "${response}"`);

            // Emit response event
            this.emit('response', {
                text: response,
                tokens: completion.usage?.total_tokens || 0
            });

            return response;

        } catch (error: any) {
            console.error('❌ Error generating AI response:', error);

            // Fallback response
            const fallbackResponse = "I apologize, I'm having trouble processing that. Could you please repeat?";

            this.emit('error', error);
            return fallbackResponse;
        }
    }

    /**
     * Generate streaming response (for future enhancement)
     */
    async generateStreamingResponse(
        context: ConversationContext,
        userMessage: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        try {
            const messages: Message[] = [
                { role: 'system', content: context.systemPrompt },
                ...context.messages,
                { role: 'user', content: userMessage }
            ];

            const recentMessages = messages.slice(-11);

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: recentMessages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                stream: true
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    onChunk(content);
                }
            }

            return fullResponse;

        } catch (error) {
            console.error('❌ Error in streaming response:', error);
            throw error;
        }
    }

    /**
     * Create default system prompt
     */
    static createSystemPrompt(purpose: string = 'general assistant'): string {
        return `You are a helpful AI assistant speaking with a customer over the phone.

Guidelines:
- Be concise and natural in your responses
- Speak in short sentences (1-2 sentences at a time)
- Use a friendly, professional tone
- Ask clarifying questions when needed
- If you don't know something, admit it honestly
- Listen carefully and respond appropriately
- Avoid long explanations unless specifically asked

Purpose: ${purpose}

Remember: You are having a voice conversation, so keep responses brief and conversational.`;
    }

    /**
     * Validate response for phone conversation
     */
    private validateResponse(response: string): boolean {
        // Check if response is too long (more than 3 sentences)
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 3) {
            console.warn('⚠️ Response too long, consider breaking it up');
        }

        // Check if response is too short
        if (response.trim().length < 5) {
            console.warn('⚠️ Response too short');
            return false;
        }

        return true;
    }
}
