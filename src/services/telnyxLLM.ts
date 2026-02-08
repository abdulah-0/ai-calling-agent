import axios from 'axios';
import EventEmitter from 'events';

export class TelnyxLLMService extends EventEmitter {
    private apiKey: string;
    private model: string;

    constructor() {
        super();
        this.apiKey = process.env.TELNYX_API_KEY || '';
        this.model = 'meta-llama/Meta-Llama-3-70B-Instruct'; // Default Telnyx model
        
        if (!this.apiKey) {
            console.error('TELNYX_API_KEY is missing');
        }
    }

    /**
     * Generate a response using Telnyx Inference API
     */
    async generateResponse(systemPrompt: string, userMessage: string, history: any[] = []): Promise<string> {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(msg => ({ role: msg.role, content: msg.content })),
                { role: 'user', content: userMessage }
            ];

            const response = await axios.post(
                'https://api.telnyx.com/v2/ai/chat/completions',
                {
                    model: this.model,
                    messages: messages,
                    stream: true // Enable streaming for faster TTS
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream'
                }
            );

            let fullText = '';

            // Handle streaming response
            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line === 'data: [DONE]') return;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.replace('data: ', ''));
                            const token = json.choices[0]?.delta?.content || '';
                            
                            if (token) {
                                fullText += token;
                                this.emit('token', token);
                            }
                        } catch (e) {
                            console.error('Error parsing Telnyx stream:', e);
                        }
                    }
                }
            });

            response.data.on('end', () => {
                this.emit('complete', fullText);
            });

            return fullText;

        } catch (error: any) {
            console.error('Telnyx LLM Error:', error.response?.data || error.message);
            this.emit('error', error);
            return "I'm sorry, I'm having trouble thinking right now.";
        }
    }

    /**
     * simple summary generation (non-streaming)
     */
    async generateSummary(text: string): Promise<string> {
        try {
            const response = await axios.post(
                'https://api.telnyx.com/v2/ai/chat/completions',
                {
                    model: this.model,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that summarizes conversations.' },
                        { role: 'user', content: text }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0]?.message?.content || 'No summary generated.';
        } catch (error) {
            console.error('Error generating summary:', error);
            return 'Failed to generate summary.';
        }
    }
}
