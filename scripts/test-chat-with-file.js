// Native fetch is available in Node 18+

async function testChatWithFile() {
    console.log("🚀 Testing /api/chat-lab with File URL...");

    // Using a public PDF URL or a fake one to test fetch behavior
    // If checking a fake one, the backend should fail gracefully (log error) and still return chat.
    const payload = {
        messages: [{ role: 'user', content: 'Di "Funciona con archivo"' }],
        systemPrompt: 'Eres un asistente de prueba.',
        // Use a dummy URL that will 404
        fileUrls: ["https://example.com/non-existent-file.pdf"]
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

        for await (const chunk of response.body) {
            const text = new TextDecoder().decode(chunk);
            process.stdout.write(text); // Should print response even if file fetch failed
        }
        console.log("\n✅ Stream finished.");

    } catch (error) {
        console.error("❌ Network or Script Error:", error);
    }
}

testChatWithFile();
