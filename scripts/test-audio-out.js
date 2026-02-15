const fs = require('fs');
const path = require('path');

async function testAudioOut() {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const apiKey = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.+)/)?.[1];

    if (!apiKey) {
        console.error("Missing API Key");
        return;
    }

    // Try TTS model
    const modelName = 'models/gemini-2.5-flash-preview-tts';
    // const modelName = 'models/gemini-2.5-flash-native-audio-latest'; 

    console.log(`Testing Audio Output with ${modelName}...`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Say 'Hello, this is a test of native audio generation' in a friendly voice." }]
                }],
                // Correctly requesting AUDIO modality
                "generationConfig": {
                    "response_modalities": ["AUDIO"]
                }
            })
        });

        if (!response.ok) {
            console.error("API Error:", await response.text());
            return;
        }

        const text = await response.text();
        const data = JSON.parse(text);

        // Write full response to file to inspect structure
        fs.writeFileSync('response_dump.json', JSON.stringify(data, null, 2));
        console.log("Full response dumped to response_dump.json");

        const parts = data.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find(p => p.inline_data || p.binary_data);

        if (audioPart) {
            console.log("✅ Audio Part Received!");
            console.log("MimeType:", audioPart.inline_data?.mime_type);
            console.log("Data Length:", audioPart.inline_data?.data?.length);
        } else {
            console.log("⚠️ No Audio Part found. Text only?");
            console.log(parts[0]?.text);
        }

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testAudioOut();
