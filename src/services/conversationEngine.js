const { GoogleGenerativeAI } = require('@google/generative-ai');
const EventEmitter = require('events');

class ConversationEngine extends EventEmitter {
    constructor() {
        super();
        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error(' GEMINI_API_KEY is missing');
            throw new Error('GEMINI_API_KEY is required');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        console.log(` Gemini AI initialized with model: ${this.modelName}`);
    }

    async generateResponse(context, userMessage) {
        try {
            console.log(` Generating AI response for: "${userMessage}"`);
            const conversationHistory = context.messages.slice(-10).map(msg => {
                const role = msg.role === 'assistant' ? 'Assistant' : 'User';
                return `${role}: ${msg.content}`;
            }).join('\n');
            const fullPrompt = `${context.systemPrompt}\n\n${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\n` : ''}User: ${userMessage}\n\nAssistant:`;
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from Gemini');
            }
            console.log(` AI response: "${text}"`);
            this.emit('response', { text: text, tokens: 0 });
            return text;
        } catch (error) {
            console.error(' Error generating AI response:', error);
            const fallbackResponse = "I apologize, I'm having trouble processing that. Could you please repeat?";
            this.emit('error', error);
            return fallbackResponse;
        }
    }

    async generateStreamingResponse(context, userMessage, onChunk) {
        return this.generateResponse(context, userMessage);
    }

    static createSystemPrompt(purpose = 'general assistant') {
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
}

module.exports = { ConversationEngine };
