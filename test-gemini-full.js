const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = 'AIzaSyBcvH7fgAn7W2Q6O1Lzc_ciyEnG3w1YgTE';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function test() {
    try {
        const result = await model.generateContent('Say hello in one sentence');
        const response = await result.response;
        const text = response.text();
        console.log('✅ Gemini API works!');
        console.log('Response:', text);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

test();
