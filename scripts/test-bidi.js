const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

async function testBidi() {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const apiKey = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.+)/)?.[1];

    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    const host = "generativelanguage.googleapis.com";
    const pathUrl = "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
    const url = `wss://${host}${pathUrl}?key=${apiKey}`;

    console.log("Connecting to:", url);
    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log("Connected!");

        // 1. Send Setup
        const setupMsg = {
            setup: {
                model: "models/gemini-2.5-flash-native-audio-latest",
                generation_config: {
                    response_modalities: ["AUDIO"]
                }
            }
        };
        ws.send(JSON.stringify(setupMsg));
        console.log("Sent Setup");

        // 2. Send Audio (Silence or Dummy)
        // 1 sec silence PCM 24kHz Mono 16bit
        const silenceBuffer = Buffer.alloc(24000 * 2, 0);
        const base64Audio = silenceBuffer.toString('base64');

        const clientContentMsg = {
            client_content: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: "Hello, this is a test. Please confirm you can hear me." }]
                    },
                    {
                        role: "user",
                        parts: [{ inline_data: { mime_type: "audio/pcm;rate=24000", data: base64Audio } }]
                    }
                ],
                turn_complete: true
            }
        };
        ws.send(JSON.stringify(clientContentMsg));
        console.log("Sent Client Content");
    });

    ws.on('message', (data) => {
        try {
            const str = data.toString();
            const msg = JSON.parse(str);
            console.log("Received:", Object.keys(msg));
            if (msg.serverContent) {
                if (msg.serverContent.modelTurn) {
                    const parts = msg.serverContent.modelTurn.parts;
                    console.log("Model Turn Parts:", parts.length);
                    if (parts[0].inlineData) {
                        console.log("Received Audio Data Length:", parts[0].inlineData.data.length);
                        ws.close();
                    }
                }
            }
        } catch (e) {
            console.log("Raw Message:", data.toString());
        }
    });

    ws.on('error', (err) => console.error("WebSocket Error:", err));
    ws.on('close', () => console.log("Closed"));
}

testBidi();
