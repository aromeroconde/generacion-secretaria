async function testRefine() {
    console.log("🪄 Testing /api/refine-lab...");

    // Simulate frontend payload
    const payload = {
        task: 'chat',
        currentPrompt: "Eres un asistente útil.",
        feedback: "Hazlo más pirata. Que diga arrgh."
    };

    try {
        const response = await fetch('http://localhost:3002/api/refine-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        console.log("✅ Response received:");
        console.log(JSON.stringify(data, null, 2));

        if (data.newPrompt && data.newPrompt.toLowerCase().includes('arr')) {
            console.log("✅ Validation Passed: Prompt became pirate-themed!");
        } else {
            console.warn("⚠️ Validation Warning: Check if prompt changed correctly.");
        }

    } catch (e) {
        console.error("❌ Network Error:", e.message);
    }
}

testRefine();
