require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testApiKey() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.includes('sua_chave')) {
            console.log("STATUS: NO_KEY_PROVIDED");
            return;
        }
        console.log("STATUS: KEY_FOUND_TESTING...");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Diga 'BOB_ESTA_VIVO'");
        console.log("STATUS: SUCCESS => " + result.response.text().trim());
    } catch (e) {
        console.log("STATUS: ERROR => " + e.message);
    }
}
testApiKey();
