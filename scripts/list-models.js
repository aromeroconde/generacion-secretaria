const fs = require('fs');
const path = require('path');

// Read key manually
const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
    console.error("No .env.local found");
    process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf-8');
const keyLine = content.split('\n').find(l => l.startsWith('GOOGLE_GENERATIVE_AI_API_KEY'));

if (!keyLine) {
    console.error("Key not found in .env.local");
    process.exit(1);
}

const key = keyLine.split('=')[1].trim();

async function listModels() {
    try {
        console.log("Fetching models with key:", key.substring(0, 10) + "...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.error("Error listing models:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
            } else {
                console.log("No models returned. Data:", data);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

listModels();
