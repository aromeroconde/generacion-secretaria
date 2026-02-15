// Native fetch is available in Node 18+

async function testChat() {
    console.log("🚀 Testing /api/chat-lab...");

    const payload = {
        messages: [{ role: 'user', content: 'Di "Funciona correctamente"' }],
        systemPrompt: 'Eres un asistente de prueba. Responde brevemente.',
        fileUrls: []
    };

    try {
        const response = await fetch('http://localhost:3002/api/chat-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`❌ Error ${response.status}: ${response.statusText}`);
            const text = await response.text();
            console.error("Response body:", text);
            return;
        }

        console.log("✅ API responded with 200 OK");

        // Read stream (Node 18+ native fetch returns a web stream, but iteration works)
        for await (const chunk of response.body) {
            const text = new TextDecoder().decode(chunk);
            process.stdout.write(text);
        }
        console.log("\n✅ Stream finished.");

    } catch (error) {
        console.error("❌ Network or Script Error:", error);
    }
}

testChat();
