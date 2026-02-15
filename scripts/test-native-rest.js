const fs = require('fs');
const path = require('path');

async function testNative() {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const apiKey = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.+)/)?.[1];

    // Testing the specific model user asked for
    const modelName = 'models/gemini-2.5-flash-native-audio-latest';

    console.log(`Testing Native Audio REST with ${modelName}...`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello, this is a test of native audio generation." }]
                }],
                generationConfig: {
                    response_modalities: ["AUDIO"]
                }
            })
        });

        if (!response.ok) {
            console.log("Error Status:", response.status);
            console.log(await response.text());
        } else {
            console.log("Success!");
            const data = await response.json();
            // Log structure to see if we get inlineData
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) { console.error(e); }
}
testNative();
