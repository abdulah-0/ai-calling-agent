const { ConversationEngine } = require('./src/services/conversationEngine.js');

// Set API key
process.env.GEMINI_API_KEY = 'AIzaSyBcvH7fgAn7W2Q6O1Lzc_ciyEnG3w1YgTE';

async function test() {
    try {
        const engine = new ConversationEngine();

        const context = {
            callId: 'test-123',
            messages: [],
            systemPrompt: ConversationEngine.createSystemPrompt('customer support'),
            metadata: {
                callPurpose: 'test',
                startTime: new Date()
            }
        };

        console.log('\n🧪 Test 1: Simple question');
        const response1 = await engine.generateResponse(context, 'Hello, how are you?');
        console.log('Response:', response1);

        // Add to context
        context.messages.push({ role: 'user', content: 'Hello, how are you?' });
        context.messages.push({ role: 'assistant', content: response1 });

        console.log('\n🧪 Test 2: Follow-up question');
        const response2 = await engine.generateResponse(context, 'What can you help me with?');
        console.log('Response:', response2);

        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

test();
