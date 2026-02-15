async function testVoiceChat() {
    try {
        console.log("Testing /api/chat-lab with Audio...");

        // Tiny invalid base64 (just to trigger the branch)
        const dummyAudio = "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

        const response = await fetch('http://localhost:3002/api/chat-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Testing voice' }],
                systemPrompt: 'You are a test assistant.',
                audioData: dummyAudio
            })
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            const text = await response.text();
            console.error("Response Body:", text);
            return;
        }

        console.log("Response OK. Stream started (this means model accepted the request context or at least tried).");
        const reader = response.body;
        for await (const chunk of reader) {
            console.log("Chunk received:", chunk.toString());
            break; // Just need to see one chunk to know it worked/started
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testVoiceChat();
