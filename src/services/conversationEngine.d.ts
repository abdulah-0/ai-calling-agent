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

export declare class ConversationEngine extends EventEmitter {
    constructor();
    generateResponse(context: ConversationContext, userMessage: string): Promise<string>;
    generateStreamingResponse(context: ConversationContext, userMessage: string, onChunk: (chunk: string) => void): Promise<string>;
    static createSystemPrompt(purpose?: string): string;
}
