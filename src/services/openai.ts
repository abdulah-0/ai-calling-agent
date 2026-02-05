import OpenAI from 'openai';
import EventEmitter from 'events';

export class OpenAIService extends EventEmitter {
    private openai: OpenAI;

    constructor() {
        super();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    public async generateResponse(systemPrompt: string, userMessage: string, history: any[]) {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ];

            const stream = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: messages as any,
                stream: true,
                max_tokens: 200,
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    this.emit('token', content);
                }
            }

            this.emit('complete', fullResponse);
            return fullResponse;

        } catch (error) {
            console.error('OpenAI Error:', error);
            this.emit('error', error);
            return null;
        }
    }

    public async generateSummary(prompt: string): Promise<string> {
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
            });

            return response.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('OpenAI Summary Error:', error);
            return '';
        }
    }
}
