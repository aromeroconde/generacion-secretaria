// Native fetch used in Node 18+

async function testChat() {
    try {
        console.log("Testing /api/chat-lab...");
        const response = await fetch('http://localhost:3002/api/chat-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hola, prueba de conexión.' }],
                systemPrompt: 'Eres un asistente de prueba.',
                knowledgeBase: ''
            })
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            const text = await response.text();
            console.error("Response Body:", text);
            return;
        }

        console.log("Response OK. Streaming...");
        const reader = response.body;
        // Node-fetch body is a stream
        reader.on('data', (chunk) => {
            console.log("Chunk received:", chunk.toString());
        });
        reader.on('end', () => {
            console.log("Stream finished.");
        });

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testChat();
